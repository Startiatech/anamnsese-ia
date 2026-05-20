// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockDebitCredit, mockVerifyToken } = vi.hoisted(() => ({
  mockDebitCredit: vi.fn(),
  mockVerifyToken: vi.fn(),
}))

vi.mock('@/lib/credits', () => ({
  CreditRepository: {
    debitCredit: mockDebitCredit,
  },
}))

vi.mock('@/lib/auth', () => ({
  verifyToken: mockVerifyToken,
  COOKIE_NAME: 'anamnese_auth',
}))

vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => ({
      json: async () => data,
      status: init?.status ?? 200,
    }),
  },
}))

import { POST } from './route'

function makeRequest(token: string | null): { cookies: { get: (name: string) => { name: string; value: string } | undefined } } {
  return {
    cookies: {
      get: (name: string) => {
        if (name === 'anamnese_auth' && token) return { name, value: token }
        return undefined
      },
    },
  }
}

describe('POST /api/auth/me/debit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no token', async () => {
    mockVerifyToken.mockResolvedValue(null)
    const res = await POST(makeRequest(null) as never)
    expect(res.status).toBe(401)
  })

  it('calls debitCredit with correct user id and returns 200', async () => {
    const payload = { sub: 'user-1', name: 'Dr. Ana', email: 'ana@clinic.com', role: 'user' }
    mockVerifyToken.mockResolvedValue(payload)
    mockDebitCredit.mockResolvedValue(undefined)

    const res = await POST(makeRequest('valid-token') as never)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true })
    expect(mockDebitCredit).toHaveBeenCalledWith('user-1')
  })
})
