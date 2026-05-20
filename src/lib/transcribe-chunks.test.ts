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

import { transcribeInChunks, CHUNK_SIZE_BYTES } from './transcribe-chunks'

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
})

describe('CHUNK_SIZE_BYTES', () => {
  it('is exactly 20MB', () => {
    expect(CHUNK_SIZE_BYTES).toBe(20 * 1024 * 1024)
  })
})
