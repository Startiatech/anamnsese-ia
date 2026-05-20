// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFindUser, mockUpdateUser, mockComparePin, mockSign, mockCheckRateLimit } = vi.hoisted(() => ({
  mockFindUser:        vi.fn(),
  mockUpdateUser:      vi.fn(),
  mockComparePin:      vi.fn(),
  mockSign:            vi.fn(),
  mockCheckRateLimit:  vi.fn(),
}))

// Mocks apontam para os imports reais usados na rota
vi.mock('@/server/repositories/users', () => ({
  findUserByEmail: mockFindUser,
  updateUser:      mockUpdateUser,
}))

vi.mock('@/server/services/auth', () => ({
  comparePin:  mockComparePin,
  signToken:   mockSign,
  COOKIE_NAME: 'anamnese_auth',
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('next/server', async () => {
  const { NextResponse: Real } = await vi.importActual<typeof import('next/server')>('next/server')
  return { NextRequest: class {}, NextResponse: Real }
})

import { POST } from './route'

function makeReq(body: object) {
  return {
    json: async () => body,
    headers: { get: () => null },
  } as unknown as import('next/server').NextRequest
}

const baseUser = {
  id: 'u1',
  email: 'a@b.com',
  name: 'Ana',
  role: 'user' as const,
  planId: 'experimental',
  specialty: 'Clínica',
  crmType: 'CRM',
  crmNumber: '12345',
  crmUf: 'SP',
  pinHash: '$2b$12$somehash',
}

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue(false)
    mockFindUser.mockResolvedValue(baseUser)
    mockUpdateUser.mockResolvedValue(undefined)
    mockComparePin.mockResolvedValue(true)
    mockSign.mockResolvedValue('token')
  })

  it('returns 400 when email is missing', async () => {
    const res = await POST(makeReq({ pin: '123456' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when pin format is invalid', async () => {
    const res = await POST(makeReq({ email: 'a@b.com', pin: 'abc' }))
    expect(res.status).toBe(400)
  })

  it('returns 401 when user not found', async () => {
    mockFindUser.mockResolvedValue(undefined)
    const res = await POST(makeReq({ email: 'x@y.com', pin: '123456' }))
    expect(res.status).toBe(401)
  })

  it('returns 401 when user has no PIN set', async () => {
    mockFindUser.mockResolvedValue({ ...baseUser, pinHash: undefined })
    const res = await POST(makeReq({ email: 'a@b.com', pin: '123456' }))
    expect(res.status).toBe(401)
  })

  it('returns 401 when pin is wrong', async () => {
    mockComparePin.mockResolvedValue(false)
    const res = await POST(makeReq({ email: 'a@b.com', pin: '000000' }))
    expect(res.status).toBe(401)
  })

  it('returns 200 and sets cookie on valid email + pin', async () => {
    const res = await POST(makeReq({ email: 'a@b.com', pin: '695812' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('sets password_is_temp=true in DB so layout guard redirects to settings', async () => {
    await POST(makeReq({ email: 'a@b.com', pin: '695812' }))
    expect(mockUpdateUser).toHaveBeenCalledWith('u1', { passwordIsTemp: true })
  })

  it('does not call updateUser when pin is wrong', async () => {
    mockComparePin.mockResolvedValue(false)
    await POST(makeReq({ email: 'a@b.com', pin: '000000' }))
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it('signs token with passwordIsTemp true so user must change password', async () => {
    await POST(makeReq({ email: 'a@b.com', pin: '695812' }))
    expect(mockSign).toHaveBeenCalledWith(
      expect.objectContaining({ passwordIsTemp: true })
    )
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValue(true)
    const res = await POST(makeReq({ email: 'a@b.com', pin: '695812' }))
    expect(res.status).toBe(429)
    expect(mockSign).not.toHaveBeenCalled()
  })
})
