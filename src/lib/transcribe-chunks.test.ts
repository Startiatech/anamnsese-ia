// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Groq from 'groq-sdk'

const { mockCreate, MockGroq } = vi.hoisted(() => {
  const mockCreate = vi.fn()
  class MockGroqClass {
    audio = { transcriptions: { create: mockCreate } }
  }
  return { mockCreate, MockGroq: MockGroqClass }
})

vi.mock('groq-sdk', () => ({
  default: MockGroq,
}))

import { transcribeInChunks, transcribeSegments, CHUNK_SIZE_BYTES } from './transcribe-chunks'

function makeFile(sizeMB: number): File {
  const bytes = new Uint8Array(sizeMB * 1024 * 1024)
  return new File([bytes], 'audio.mp3', { type: 'audio/mpeg' })
}

function makeGroq(): Groq {
  return new MockGroq() as unknown as Groq
}

describe('transcribeInChunks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreate.mockResolvedValue('texto transcrito')
  })

  it('calls Groq once for a file smaller than CHUNK_SIZE_BYTES', async () => {
    const file = makeFile(5)
    const groq = makeGroq()
    const result = await transcribeInChunks(file, groq)
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(result).toBe('texto transcrito')
  })

  it('calls Groq once per chunk for large files and joins with space', async () => {
    mockCreate
      .mockResolvedValueOnce('primeira parte')
      .mockResolvedValueOnce('segunda parte')
      .mockResolvedValueOnce('terceira parte')

    // 45MB -> 3 chunks (20 + 20 + 5)
    const file = makeFile(45)
    const groq = makeGroq()
    const result = await transcribeInChunks(file, groq)

    expect(mockCreate).toHaveBeenCalledTimes(3)
    expect(result).toBe('primeira parte segunda parte terceira parte')
  })

  it('passes correct file name and type to each chunk', async () => {
    const file = makeFile(5)
    const groq = makeGroq()
    await transcribeInChunks(file, groq)

    const calledFile = mockCreate.mock.calls[0][0].file as File
    expect(calledFile.name).toBe('audio.mp3')
    expect(calledFile.type).toBe('audio/mpeg')
  })

  it('propagates error if any chunk fails', async () => {
    mockCreate
      .mockResolvedValueOnce('primeira parte')
      .mockRejectedValueOnce(new Error('Groq timeout'))

    const file = makeFile(45)
    const groq = makeGroq()
    await expect(transcribeInChunks(file, groq)).rejects.toThrow('Groq timeout')
  })

  it('throws for empty file', async () => {
    const emptyFile = new File([], 'empty.mp3', { type: 'audio/mpeg' })
    const groq = makeGroq()
    await expect(transcribeInChunks(emptyFile, groq)).rejects.toThrow('O arquivo de áudio está vazio.')
  })

  it('calls onChunk once per chunk with the transcribed text', async () => {
    mockCreate
      .mockResolvedValueOnce('parte um')
      .mockResolvedValueOnce('parte dois')
      .mockResolvedValueOnce('parte tres')

    const file = makeFile(45)
    const groq = makeGroq()
    const onChunk = vi.fn()
    await transcribeInChunks(file, groq, onChunk)

    expect(onChunk).toHaveBeenCalledTimes(3)
    expect(onChunk).toHaveBeenNthCalledWith(1, 'parte um')
    expect(onChunk).toHaveBeenNthCalledWith(2, 'parte dois')
    expect(onChunk).toHaveBeenNthCalledWith(3, 'parte tres')
  })

  it('works normally without onChunk (backward compatible)', async () => {
    const file = makeFile(5)
    const groq = makeGroq()
    const result = await transcribeInChunks(file, groq)
    expect(result).toBe('texto transcrito')
  })

  it('sends temperature 0 and a medical prompt to Groq', async () => {
    const file = makeFile(5)
    const groq = makeGroq()
    await transcribeInChunks(file, groq)

    const args = mockCreate.mock.calls[0][0] as { temperature: number; prompt: string }
    expect(args.temperature).toBe(0)
    expect(args.prompt).toContain('consulta médica')
  })

  it('filters isolated hallucination phrases from the result', async () => {
    mockCreate.mockResolvedValueOnce('Paciente refere cefaleia.\nTchau')
    const file = makeFile(5)
    const groq = makeGroq()
    const result = await transcribeInChunks(file, groq)
    expect(result).toBe('Paciente refere cefaleia.')
  })

  it('calls onChunk with the filtered text (not raw)', async () => {
    mockCreate.mockResolvedValueOnce('Paciente refere dor.\nTchau')
    const file = makeFile(5)
    const groq = makeGroq()
    const onChunk = vi.fn()
    await transcribeInChunks(file, groq, onChunk)
    expect(onChunk).toHaveBeenCalledWith('Paciente refere dor.')
  })
})

describe('transcribeSegments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreate.mockResolvedValue('texto transcrito')
  })

  it('transcribes each segment independently and joins with space', async () => {
    // Cada segmento é um WebM válido próprio — não devem ser concatenados em bytes.
    mockCreate.mockResolvedValueOnce('trecho um').mockResolvedValueOnce('trecho dois')
    const groq = makeGroq()
    const result = await transcribeSegments([makeFile(2), makeFile(2)], groq)
    expect(mockCreate).toHaveBeenCalledTimes(2)
    expect(result).toBe('trecho um trecho dois')
  })

  it('streams onChunk for every segment', async () => {
    mockCreate.mockResolvedValueOnce('a').mockResolvedValueOnce('b')
    const onChunk = vi.fn()
    await transcribeSegments([makeFile(2), makeFile(2)], makeGroq(), onChunk)
    expect(onChunk).toHaveBeenCalledTimes(2)
  })

  it('handles a single segment', async () => {
    mockCreate.mockResolvedValueOnce('unico')
    const result = await transcribeSegments([makeFile(2)], makeGroq())
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(result).toBe('unico')
  })

  it('skips fully-hallucinated (empty) segments when joining', async () => {
    mockCreate.mockResolvedValueOnce('parte boa').mockResolvedValueOnce('Tchau')
    const result = await transcribeSegments([makeFile(2), makeFile(2)], makeGroq())
    expect(result).toBe('parte boa')
  })

  it('throws when no segments are provided', async () => {
    await expect(transcribeSegments([], makeGroq())).rejects.toThrow()
  })
})

describe('CHUNK_SIZE_BYTES', () => {
  it('is exactly 20MB', () => {
    expect(CHUNK_SIZE_BYTES).toBe(20 * 1024 * 1024)
  })
})
