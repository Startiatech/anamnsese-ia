// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRequireActiveUser, mockGroqCreate } = vi.hoisted(() => ({
  mockRequireActiveUser: vi.fn(),
  mockGroqCreate: vi.fn(),
}))

vi.mock('@/server/services/session', () => ({
  requireActiveUser: mockRequireActiveUser,
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
  transcript: 'Paciente relata dor de cabeça há 3 dias.',
  sections: ['Queixa principal', 'História da moléstia atual'],
}

const groqSections = [
  { title: 'Queixa principal', content: 'Cefaleia há 3 dias.' },
  { title: 'História da moléstia atual', content: 'Dor progressiva, sem febre.' },
]

describe('POST /api/anamnesis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GROQ_API_KEY = 'test-key'
    mockRequireActiveUser.mockResolvedValue({ sub: 'user-1' })
    mockGroqCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ sections: groqSections }) } }],
    })
  })

  it('returns 401 when unauthenticated', async () => {
    mockRequireActiveUser.mockResolvedValue(null)
    const res = await POST(makeRequest(validBody) as never)
    expect(res.status).toBe(401)
  })

  it('returns 400 when transcript is missing', async () => {
    const res = await POST(makeRequest({ sections: ['Queixa principal'] }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when sections array is empty', async () => {
    const res = await POST(makeRequest({ transcript: 'texto', sections: [] }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 200 with sections when Groq returns valid JSON', async () => {
    const res = await POST(makeRequest(validBody) as never)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sections).toEqual(groqSections)
  })

  it('returns 502 when Groq returns malformed JSON', async () => {
    mockGroqCreate.mockResolvedValue({
      choices: [{ message: { content: 'não é json válido' } }],
    })
    const res = await POST(makeRequest(validBody) as never)
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toBe('Resposta inválida da IA. Tente novamente.')
  })

  it('returns 502 when Groq returns JSON without sections array', async () => {
    mockGroqCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ other: 'field' }) } }],
    })
    const res = await POST(makeRequest(validBody) as never)
    expect(res.status).toBe(502)
  })

  it('returns 503 when GROQ_API_KEY is not set', async () => {
    const original = process.env.GROQ_API_KEY
    delete process.env.GROQ_API_KEY
    try {
      const res = await POST(makeRequest(validBody) as never)
      expect(res.status).toBe(503)
    } finally {
      process.env.GROQ_API_KEY = original
    }
  })
})
