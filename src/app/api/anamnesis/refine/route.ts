import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { requireActiveUser } from '@/server/services/session'
import { supabase } from '@/server/supabase'
import type { Section } from '@/types'
import { UsageRepository, calcLlamaCost } from '@/server/repositories/usage'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY ?? '' })

export async function POST(req: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'Serviço de IA indisponível.' }, { status: 503 })
  }

  const user = await requireActiveUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    sections: Section[]
    instruction: string
    patientId: string
  }

  if (!body.sections?.length || !body.instruction?.trim() || !body.patientId) {
    return NextResponse.json(
      { error: 'sections, instruction e patientId são obrigatórios.' },
      { status: 400 },
    )
  }

  if (body.instruction.length > 1000) {
    return NextResponse.json({ error: 'Instrução excede o tamanho máximo de 1000 caracteres.' }, { status: 400 })
  }

  // Fetch transcript first — if missing, abort before charging any quota
  const { data: consultationData } = await supabase
    .from('consultations')
    .select('raw_transcript')
    .eq('user_id', user.sub)
    .eq('patient_id', body.patientId)
    .single()

  const rawTranscript = (consultationData?.raw_transcript as string | null) ?? null

  if (!rawTranscript?.trim()) {
    return NextResponse.json(
      { error: 'Transcrição não disponível. Não é possível refinar sem a transcrição original da consulta.' },
      { status: 422 },
    )
  }

  // Increment quota only after transcript is confirmed — RPC raises exception if quota exceeded
  const { data: newCount, error: rpcError } = await supabase.rpc(
    'increment_refinement_attempt',
    { p_user_id: user.sub, p_patient_id: body.patientId },
  )

  if (rpcError) {
    if (rpcError.message?.includes('refinement_quota_exceeded')) {
      return NextResponse.json({ error: 'Limite de refinamentos atingido para este plano.' }, { status: 429 })
    }
    if (rpcError.message?.includes('consultation_not_found')) {
      return NextResponse.json({ error: 'Consulta não encontrada.' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Erro ao verificar quota.' }, { status: 500 })
  }

  const sectionsJson = JSON.stringify(body.sections, null, 2)

  const prompt = `Você é um assistente médico especializado em anamnese clínica.

TRANSCRIÇÃO ORIGINAL DA CONSULTA (única e exclusiva fonte de verdade):
${rawTranscript}

ANAMNESE ATUAL (gerada a partir da transcrição acima):
${sectionsJson}

INSTRUÇÃO DE REFINAMENTO DO PROFISSIONAL:
${body.instruction}

O QUE "REFINAR" SIGNIFICA:
Refinar é reformular, reorganizar ou reescrever com terminologia médica adequada o conteúdo que JÁ EXISTE na transcrição. Refinar NÃO é acrescentar informações novas, complementar com conhecimento clínico externo ou deduzir o que poderia ter sido dito.

REGRAS ABSOLUTAS — NUNCA VIOLE:
1. USE SOMENTE informações explicitamente ditas na transcrição. Se não está na transcrição, não existe para você.
2. NUNCA adicione exames, medicamentos, doses, condutas, hipóteses diagnósticas ou achados clínicos que não foram verbalizados na consulta, mesmo que sejam clinicamente óbvios ou indicados.
3. Se uma seção está vaga ou vazia porque o assunto NÃO FOI abordado na consulta, escreva exatamente: "Não informado na consulta." — nada mais.
4. A instrução do profissional define apenas o ESTILO do refinamento (mais técnico, mais detalhado, mais conciso). O CONTEÚDO vem exclusivamente da transcrição.
5. Se a instrução mencionar uma seção específica, ajuste apenas ela; mantenha o restante intacto.
6. Mantenha os mesmos títulos de seção (title).
7. Responda SOMENTE com um JSON válido, sem markdown, sem explicações adicionais.

FORMATO DE RESPOSTA (JSON):
{
  "sections": [
    { "title": "Nome da seção", "content": "Conteúdo revisado" }
  ]
}`

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      response_format: { type: 'json_object' },
    })

    const raw = completion.choices[0]?.message?.content ?? ''

    let parsed: { sections: Section[] }
    try {
      parsed = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'Resposta inválida da IA. Tente novamente.' }, { status: 502 })
    }

    if (!Array.isArray(parsed.sections)) {
      return NextResponse.json({ error: 'Resposta inválida da IA. Tente novamente.' }, { status: 502 })
    }

    const usage = completion.usage
    if (usage) {
      void UsageRepository.logApiUsage({
        userId:       user.sub,
        patientId:    body.patientId,
        endpoint:     'refine',
        model:        'llama-3.3-70b-versatile',
        tokensInput:  usage.prompt_tokens,
        tokensOutput: usage.completion_tokens,
        costUsd:      calcLlamaCost(usage.prompt_tokens, usage.completion_tokens),
      })
    }

    return NextResponse.json({ sections: parsed.sections, refinementCount: newCount as number })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao refinar anamnese.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
