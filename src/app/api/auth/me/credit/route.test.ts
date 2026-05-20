// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockGetCredits, mockSetCredits, mockVerifyToken, mockCheckRateLimit } = vi.hoisted(() => ({
  mockGetCredits: vi.fn(),
  mockSetCredits: vi.fn(),
  mockVerifyToken: vi.fn(),
  mockCheckRateLimit: vi.fn(),
}))

vi.mock('@/server/repositories/credits', () => ({
  CreditRepository: {
    getCredits: mockGetCredits,
    setCredits: mockSetCredits,
  },
}))

vi.mock('@/server/services/auth', () => ({
  verifyToken: mockVerifyToken,
  COOKIE_NAME: 'anamnese_auth',
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => ({
      json: async () => data,
      status: init?.status ?? 200,
    }),
  },
}))

// Import after mocks are defined
import { POST } from './route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(token: string | null): { cookies: { get: (name: string) => { name: string; value: string } | undefined } } {
  return {
    cookies: {
      get: (name: string) => {
        if (name === 'anamnese_auth' && token) {
          return { name, value: token }
        }
        return undefined
      },
    },
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/auth/me/credit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue(false)
  })

  it('returns 401 when no token', async () => {
    mockVerifyToken.mockResolvedValue(null)

    const req = makeRequest(null)
    const res = await POST(req as never)
    expect(res.status).toBe(401)
  })

  it('returns 200 with ok: true on successful credit', async () => {
    const mockPayload = { sub: 'user-1', name: 'Test', email: 'a@a.com', role: 'user' }
    mockVerifyToken.mockResolvedValue(mockPayload)
    mockGetCredits.mockResolvedValue(1)
    mockSetCredits.mockResolvedValue(undefined)

    const req = makeRequest('fake-token')
    const res = await POST(req as never)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true })
    expect(mockSetCredits).toHaveBeenCalledWith('user-1', 2)
  })
})
