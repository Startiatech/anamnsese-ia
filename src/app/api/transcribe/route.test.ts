// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRequireActiveUser, mockTranscribeInChunks, mockSaveTranscript } = vi.hoisted(() => ({
  mockRequireActiveUser: vi.fn(),
  mockTranscribeInChunks: vi.fn(),
  mockSaveTranscript: vi.fn(),
}))

vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => ({
      json: async () => data,
      status: init?.status ?? 200,
    }),
  },
}))

vi.mock('@/server/services/session', () => ({ requireActiveUser: mockRequireActiveUser }))

vi.mock('@/lib/transcribe-chunks', () => ({ transcribeInChunks: mockTranscribeInChunks }))

vi.mock('@/server/actions/consultation', () => ({
  saveTranscriptAndIncrementAttempts: mockSaveTranscript,
}))

vi.mock('@/server/supabase', () => ({
  supabase: {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'consultations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { audio_attempts: 0 } }),
              }),
            }),
          }),
        }
      }
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { plan_id: 'experimental' } }),
            }),
          }),
        }
      }
      if (table === 'plans') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { features: [{ id: 'f5', limit: 2 }] },
              }),
            }),
          }),
        }
      }
      // fallback (api_usage_log e outros)
      return { insert: vi.fn().mockResolvedValue({ error: null }) }
    }),
  },
}))

vi.mock('groq-sdk', () => ({
  default: class Groq {},
}))

import { POST } from './route'

function makeFormData(file: File | null, patientId: string | null = 'patient-1'): Request {
  const fd = new FormData()
  if (file) fd.append('audio', file)
  if (patientId) fd.append('patientId', patientId)
  return { formData: async () => fd } as unknown as Request
}

function makeFile(name: string, sizeMB = 2): File {
  const bytes = new Uint8Array(sizeMB * 1024 * 1024)
  return new File([bytes], name, { type: 'audio/mpeg' })
}

describe('POST /api/transcribe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GROQ_API_KEY = 'test-key'
    mockRequireActiveUser.mockResolvedValue({ sub: 'user-1' })
    mockTranscribeInChunks.mockImplementation(async (_file: File, _groq: unknown, onChunk?: (t: string) => void) => {
      onChunk?.('texto transcrito')
      return 'texto transcrito'
    })
    mockSaveTranscript.mockResolvedValue(undefined)
  })

  it('returns 401 when unauthenticated', async () => {
    mockRequireActiveUser.mockResolvedValue(null)
    const res = await POST(makeFormData(makeFile('audio.mp3')) as never)
    expect(res.status).toBe(401)
  })

  it('returns 400 when audio file is missing', async () => {
    const res = await POST(makeFormData(null) as never)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Arquivo de áudio não enviado.')
  })

  it('returns 400 when patientId is missing', async () => {
    const fd = new FormData()
    fd.append('audio', makeFile('audio.mp3'))
    const req = { formData: async () => fd } as unknown as Request
    const res = await POST(req as never)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('patientId não informado.')
  })

  it('returns 503 when GROQ_API_KEY is not set', async () => {
    const original = process.env.GROQ_API_KEY
    delete process.env.GROQ_API_KEY
    try {
      const res = await POST(makeFormData(makeFile('audio.mp3')) as never)
      expect(res.status).toBe(503)
    } finally {
      process.env.GROQ_API_KEY = original
    }
  })

  it('returns 403 when audio_attempts >= plan limit', async () => {
    const { supabase } = await import('@/server/supabase')
    // consultations: audio_attempts = 2 (at limit)
    vi.mocked(supabase.from).mockImplementationOnce((_table: string) => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { audio_attempts: 2 } }),
          }),
        }),
      }),
    }) as never)
    // users: plan_id = 'experimental'
    vi.mocked(supabase.from).mockImplementationOnce((_table: string) => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { plan_id: 'experimental' } }),
        }),
      }),
    }) as never)
    // plans: f5 limit = 2
    vi.mocked(supabase.from).mockImplementationOnce((_table: string) => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { features: [{ id: 'f5', limit: 2 }] },
          }),
        }),
      }),
    }) as never)
    const res = await POST(makeFormData(makeFile('audio.mp3')) as never)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Cota de tentativas esgotada.')
  })

  it('returns 400 when file mimetype is not audio/*', async () => {
    const file = new File([new Uint8Array(100)], 'malware.exe', { type: 'application/octet-stream' })
    const res = await POST(makeFormData(file) as never)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('áudio')
  })

  it('returns 400 when file exceeds 100MB', async () => {
    const file = new File([new Uint8Array(100)], 'big.mp3', { type: 'audio/mpeg' })
    Object.defineProperty(file, 'size', { value: 101 * 1024 * 1024 })
    const res = await POST(makeFormData(file) as never)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('100MB')
  })

  it('returns streaming Response on success', async () => {
    const res = await POST(makeFormData(makeFile('audio.mp3')) as never)
    expect(res).toBeInstanceOf(Response)
    expect(res.headers.get('Content-Type')).toContain('text/plain')
  })

  it('calls saveTranscriptAndIncrementAttempts after transcription', async () => {
    const res = await POST(makeFormData(makeFile('audio.mp3')) as never)
    // consume stream
    if (res instanceof Response) {
      const reader = res.body!.getReader()
      while (true) {
        const { done } = await reader.read()
        if (done) break
      }
    }
    expect(mockSaveTranscript).toHaveBeenCalledWith('patient-1', 'texto transcrito')
  })
})
