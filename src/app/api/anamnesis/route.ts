import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { requireActiveUser } from '@/server/services/session'
import { UsageRepository, calcLlamaCost } from '@/server/repositories/usage'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY ?? '' })

export async function POST(req: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'Serviço de IA indisponível.' }, { status: 503 })
  }

  const user = await requireActiveUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { transcript: string; sections: string[]; patientId?: string }

  if (!body.transcript || !body.sections?.length) {
    return NextResponse.json({ error: 'transcript e sections são obrigatórios.' }, { status: 400 })
  }

  if (body.transcript.length > 50000) {
    return NextResponse.json({ error: 'Transcrição excede o tamanho máximo permitido.' }, { status: 400 })
  }

  if (body.sections.length > 20) {
    return NextResponse.json({ error: 'Máximo de 20 seções por anamnese.' }, { status: 400 })
  }

  const sectionsList = body.sections.map(s => `- ${s}`).join('\n')

  const prompt = `Você é um assistente médico especializado em anamnese clínica.
Com base na transcrição da consulta abaixo, gere uma anamnese estruturada nas seções solicitadas.

TRANSCRIÇÃO:
${body.transcript}

SEÇÕES SOLICITADAS:
${sectionsList}

INSTRUÇÕES:
- Preencha cada seção com informações extraídas da transcrição.
- Se uma seção não tiver informações suficientes na transcrição, escreva "Não informado."
- Seja claro, objetivo e use linguagem médica adequada.
- Responda SOMENTE com um JSON válido, sem markdown, sem explicações adicionais.

FORMATO DE RESPOSTA (JSON):
{
  "sections": [
    { "title": "Nome da seção", "content": "Conteúdo da seção" }
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

    let parsed: { sections: { title: string; content: string }[] }
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
        patientId:    body.patientId ?? null,
        endpoint:     'anamnesis',
        model:        'llama-3.3-70b-versatile',
        tokensInput:  usage.prompt_tokens,
        tokensOutput: usage.completion_tokens,
        costUsd:      calcLlamaCost(usage.prompt_tokens, usage.completion_tokens),
      })
    }

    return NextResponse.json({ sections: parsed.sections })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao gerar anamnese.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
