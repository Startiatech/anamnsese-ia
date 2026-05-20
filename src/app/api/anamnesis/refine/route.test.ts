// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRequireActiveUser, mockGroqCreate, mockRpc, mockFrom } = vi.hoisted(() => ({
  mockRequireActiveUser: vi.fn(),
  mockGroqCreate: vi.fn(),
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('@/server/services/session', () => ({
  requireActiveUser: mockRequireActiveUser,
}))

vi.mock('@/server/supabase', () => ({
  supabase: {
    rpc: mockRpc,
    from: mockFrom,
  },
}))

vi.mock('groq-sdk', () => ({
  default: class Groq {
    chat = { completions: { create: mockGroqCreate } }
  },
}))

vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => ({
      json: async () => data,
      status: init?.status ?? 200,
    }),
  },
}))

vi.mock('@/server/repositories/usage', () => ({
  UsageRepository: { logApiUsage: vi.fn().mockResolvedValue(undefined) },
  calcLlamaCost: vi.fn().mockReturnValue(0),
}))

import { POST } from './route'

function makeRequest(body: unknown): { json: () => Promise<unknown> } {
  return { json: async () => body }
}

const validBody = {
  sections: [
    { title: 'Queixa principal', content: 'Cefaleia há 3 dias.' },
  ],
  instruction: 'Reescreva a queixa em linguagem mais formal.',
  patientId: 'patient-1',
}

const refinedSections = [
  { title: 'Queixa principal', content: 'O paciente refere cefaleia com duração de três dias.' },
]

function makeFromMock(rawTranscript: string | null) {
  const mockSingle = vi.fn().mockResolvedValue({
    data: { raw_transcript: rawTranscript },
    error: null,
  })
  const mockEq2 = vi.fn(() => ({ single: mockSingle }))
  const mockEq1 = vi.fn(() => ({ eq: mockEq2 }))
  const mockSelect = vi.fn(() => ({ eq: mockEq1 }))
  mockFrom.mockReturnValue({ select: mockSelect })
  return { mockSingle, mockEq2, mockEq1, mockSelect }
}

describe('POST /api/anamnesis/refine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GROQ_API_KEY = 'test-key'
    mockRequireActiveUser.mockResolvedValue({ sub: 'user-1' })
    mockRpc.mockResolvedValue({ data: 1, error: null })
    mockGroqCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ sections: refinedSections }) } }],
    })
    makeFromMock('Paciente relata cefaleia há 3 dias.')
  })

  it('returns 401 when unauthenticated', async () => {
    mockRequireActiveUser.mockResolvedValue(null)
    const res = await POST(makeRequest(validBody) as never)
    expect(res.status).toBe(401)
  })

  it('returns 400 when sections is missing', async () => {
    const res = await POST(makeRequest({ instruction: 'x', patientId: 'p-1' }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when instruction is blank', async () => {
    const res = await POST(makeRequest({ ...validBody, instruction: '   ' }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when patientId is missing', async () => {
    const res = await POST(makeRequest({ sections: validBody.sections, instruction: 'x' }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 429 when RPC signals quota exceeded', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'refinement_quota_exceeded' },
    })
    const res = await POST(makeRequest(validBody) as never)
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toContain('Limite de refinamentos')
  })

  it('returns 404 when RPC signals consultation not found', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'consultation_not_found' },
    })
    const res = await POST(makeRequest(validBody) as never)
    expect(res.status).toBe(404)
  })

  it('returns 422 when raw_transcript is null', async () => {
    makeFromMock(null)
    const res = await POST(makeRequest(validBody) as never)
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toContain('Transcrição não disponível')
  })

  it('returns 422 when raw_transcript is empty string', async () => {
    makeFromMock('   ')
    const res = await POST(makeRequest(validBody) as never)
    expect(res.status).toBe(422)
  })

  it('includes transcript in Groq prompt', async () => {
    await POST(makeRequest(validBody) as never)
    const callArg = mockGroqCreate.mock.calls[0][0] as { messages: { content: string }[] }
    expect(callArg.messages[0].content).toContain('Paciente relata cefaleia há 3 dias.')
  })

  it('returns 200 with refined sections and refinementCount', async () => {
    const res = await POST(makeRequest(validBody) as never)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sections).toEqual(refinedSections)
    expect(body.refinementCount).toBe(1)
  })

  it('calls increment_refinement_attempt with correct params', async () => {
    await POST(makeRequest(validBody) as never)
    expect(mockRpc).toHaveBeenCalledWith('increment_refinement_attempt', {
      p_user_id: 'user-1',
      p_patient_id: 'patient-1',
    })
  })

  it('returns 502 when Groq returns malformed JSON', async () => {
    mockGroqCreate.mockResolvedValue({
      choices: [{ message: { content: 'não é json' } }],
    })
    const res = await POST(makeRequest(validBody) as never)
    expect(res.status).toBe(502)
  })

  it('does NOT call increment_refinement_attempt when raw_transcript is missing', async () => {
    makeFromMock(null)
    await POST(makeRequest(validBody) as never)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('does NOT call increment_refinement_attempt when raw_transcript is empty', async () => {
    makeFromMock('   ')
    await POST(makeRequest(validBody) as never)
    expect(mockRpc).not.toHaveBeenCalled()
  })
})
