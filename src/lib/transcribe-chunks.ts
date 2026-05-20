import type Groq from 'groq-sdk'

export const CHUNK_SIZE_BYTES = 20 * 1024 * 1024 // 20MB

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
    const text = await groq.audio.transcriptions.create({
      file: chunkFile,
      model: 'whisper-large-v3',
      language: 'pt',
      response_format: 'text',
    }) as unknown as string
    transcripts.push(text)
    onChunk?.(text)
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
