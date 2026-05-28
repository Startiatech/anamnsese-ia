import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import Groq from 'groq-sdk'
import { requireActiveUser } from '@/server/services/session'
import { transcribeSegments } from '@/lib/transcribe-chunks'
import { saveTranscriptAndIncrementAttempts } from '@/server/actions/consultation'
import { supabase } from '@/server/supabase'
import { UsageRepository, calcWhisperCost } from '@/server/repositories/usage'

// Rough estimate: average voice recording ~32kbps = 4000 bytes/s
const AUDIO_BYTES_PER_SECOND = 4000

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY ?? '' })

export async function POST(req: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'Serviço de transcrição indisponível.' }, { status: 503 })
  }

  const user = await requireActiveUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  // Gravações podem enviar vários segmentos WebM independentes (key 'audio' repetida);
  // upload de arquivo envia um único 'audio'. getAll cobre os dois casos.
  const files = formData.getAll('audio').filter((v): v is File => v instanceof File)
  const patientId = formData.get('patientId') as string | null

  if (files.length === 0) {
    return NextResponse.json({ error: 'Arquivo de áudio não enviado.' }, { status: 400 })
  }
  if (!files.every((f) => f.type.startsWith('audio/'))) {
    return NextResponse.json({ error: 'Formato inválido. Envie um arquivo de áudio.' }, { status: 400 })
  }
  const MAX_BYTES = 100 * 1024 * 1024
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0)
  if (totalBytes > MAX_BYTES) {
    return NextResponse.json({ error: 'Arquivo muito grande. Limite: 100MB.' }, { status: 400 })
  }
  if (!patientId) {
    return NextResponse.json({ error: 'patientId não informado.' }, { status: 400 })
  }

  // Check quota
  const { data: consultation } = await supabase
    .from('consultations')
    .select('audio_attempts')
    .eq('user_id', user.sub)
    .eq('patient_id', patientId)
    .single()

  const { data: userData } = await supabase
    .from('users')
    .select('plan_id')
    .eq('id', user.sub)
    .single()

  const planId = (userData?.plan_id as string | null) ?? 'experimental'

  const { data: planData } = await supabase
    .from('plans')
    .select('features')
    .eq('id', planId)
    .single()

  const features = (planData?.features ?? []) as { id: string; limit?: number | null }[]
  const f5 = features.find(f => f.id === 'f5')
  const limit = f5?.limit ?? null
  const used = (consultation?.audio_attempts ?? 0) as number

  if (limit !== null && used >= limit) {
    return NextResponse.json({ error: 'Cota de tentativas esgotada.' }, { status: 403 })
  }

  // Stream transcription
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const transcript = await transcribeSegments(files, groq, (chunkText) => {
          controller.enqueue(encoder.encode(chunkText + '\n'))
        })
        await saveTranscriptAndIncrementAttempts(patientId, transcript)
        const audioSeconds = totalBytes / AUDIO_BYTES_PER_SECOND
        void UsageRepository.logApiUsage({
          userId:       user.sub,
          patientId,
          endpoint:     'transcription',
          model:        'whisper-large-v3',
          audioSeconds: Math.round(audioSeconds * 100) / 100,
          costUsd:      calcWhisperCost(audioSeconds),
        })
        controller.enqueue(encoder.encode('__DONE__\n'))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro na transcrição.'
        controller.enqueue(encoder.encode(`__ERROR__:${message}\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
