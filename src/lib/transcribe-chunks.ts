import type Groq from 'groq-sdk'
import { filterHallucinations } from './hallucination-filter'

export const CHUNK_SIZE_BYTES = 20 * 1024 * 1024 // 20MB

export const TRANSCRIPTION_PROMPT = 'Transcrição de consulta médica em português do Brasil.'

export async function transcribeInChunks(
  file: File,
  groq: Groq,
  onChunk?: (text: string) => void,
): Promise<string> {
  const buffer = await file.arrayBuffer()

  if (buffer.byteLength === 0) {
    throw new Error('O arquivo de áudio está vazio.')
  }

  const chunks = splitBuffer(buffer, CHUNK_SIZE_BYTES)

  const transcripts: string[] = []
  for (const chunk of chunks) {
    const chunkFile = new File([chunk], file.name, { type: file.type })
    // Groq SDK does not narrow return type for response_format: 'text'; cast is intentional
    const raw = await groq.audio.transcriptions.create({
      file: chunkFile,
      model: 'whisper-large-v3',
      language: 'pt',
      response_format: 'text',
      temperature: 0,
      prompt: TRANSCRIPTION_PROMPT,
    }) as unknown as string
    const text = filterHallucinations(raw)
    // chunk totalmente alucinado vira '' aqui; espaço cosmético no join é tolerado (YAGNI)
    transcripts.push(text)
    onChunk?.(text)
  }

  return transcripts.join(' ')
}

/**
 * Transcreve uma lista de segmentos de áudio independentes e junta os textos.
 *
 * Cada segmento gravado pelo MediaRecorder é um container WebM completo e válido.
 * Concatenar os bytes de vários WebM produz um arquivo inválido (o demuxer lê só o
 * primeiro Segment), perdendo silenciosamente todo o áudio após o primeiro trecho.
 * Por isso transcrevemos cada segmento separadamente e juntamos as transcrições.
 */
export async function transcribeSegments(
  files: File[],
  groq: Groq,
  onChunk?: (text: string) => void,
): Promise<string> {
  if (files.length === 0) {
    throw new Error('Nenhum segmento de áudio enviado.')
  }

  const transcripts: string[] = []
  for (const file of files) {
    const text = await transcribeInChunks(file, groq, onChunk)
    if (text) transcripts.push(text)
  }

  return transcripts.join(' ')
}

function splitBuffer(buffer: ArrayBuffer, chunkSize: number): ArrayBuffer[] {
  const chunks: ArrayBuffer[] = []
  let offset = 0
  while (offset < buffer.byteLength) {
    chunks.push(buffer.slice(offset, offset + chunkSize))
    offset += chunkSize
  }
  return chunks
}
