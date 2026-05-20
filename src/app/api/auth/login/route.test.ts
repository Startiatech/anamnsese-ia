// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFindUser, mockCompare, mockSign, mockIsLegacy } = vi.hoisted(() => ({
  mockFindUser: vi.fn(),
  mockCompare: vi.fn(),
  mockSign: vi.fn(),
  mockIsLegacy: vi.fn(),
}))

vi.mock('@/lib/users', () => ({
  findUserByEmail: mockFindUser,
  updateUser: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  comparePassword: mockCompare,
  signToken: mockSign,
  isLegacyHash: mockIsLegacy,
  hashPassword: vi.fn().mockResolvedValue('new-hash'),
  COOKIE_NAME: 'anamnese_auth',
}))

vi.mock('next/server', async () => {
  const { NextResponse: Real } = await vi.importActual<typeof import('next/server')>('next/server')
  return { NextRequest: class {}, NextResponse: Real }
})

import { POST } from './route'

function makeReq(body: object, ip = '1.2.3.4') {
  return {
    json: async () => body,
    headers: { get: (h: string) => (h === 'x-forwarded-for' ? ip : null) },
    cookies: { set: vi.fn() },
  } as unknown as import('next/server').NextRequest
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindUser.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      name: 'Ana',
      role: 'user',
      planId: 'p1',
      specialty: 'X',
      crmType: null,
      crmNumber: null,
      crmUf: null,
      passwordHash: 'hash',
    })
    mockCompare.mockResolvedValue(true)
    mockSign.mockResolvedValue('token')
    mockIsLegacy.mockReturnValue(false)
  })

  it('returns 400 when email is missing', async () => {
    const res = await POST(makeReq({ password: 'abc' }))
    expect(res.status).toBe(400)
  })

  it('returns 401 when user not found', async () => {
    mockFindUser.mockResolvedValue(null)
    const res = await POST(makeReq({ email: 'x@y.com', password: 'abc' }))
    expect(res.status).toBe(401)
  })

  it('returns 401 when password is wrong', async () => {
    mockCompare.mockResolvedValue(false)
    const res = await POST(makeReq({ email: 'a@b.com', password: 'wrong' }))
    expect(res.status).toBe(401)
  })

  it('returns 200 on valid credentials', async () => {
    const res = await POST(makeReq({ email: 'a@b.com', password: 'correct' }))
    expect(res.status).toBe(200)
  })

  it('returns 429 after 5 failed attempts for same IP+email pair', async () => {
    mockCompare.mockResolvedValue(false)
    const ip = '9.9.9.9'
    for (let i = 0; i < 5; i++) {
      await POST(makeReq({ email: 'a@b.com', password: 'wrong' }, ip))
    }
    const res = await POST(makeReq({ email: 'a@b.com', password: 'wrong' }, ip))
    expect(res.status).toBe(429)
  })

  it('does not block a different email from the same IP', async () => {
    mockCompare.mockResolvedValue(false)
    const ip = '9.9.9.9'
    for (let i = 0; i < 5; i++) {
      await POST(makeReq({ email: 'blocked@b.com', password: 'wrong' }, ip))
    }
    // mesmo IP, email diferente — não deve ser bloqueado
    mockCompare.mockResolvedValue(true)
    const res = await POST(makeReq({ email: 'other@b.com', password: 'correct' }, ip))
    expect(res.status).toBe(200)
  })

  it('blocks valid credentials when IP+email pair is rate-limited', async () => {
    mockCompare.mockResolvedValue(false)
    const ip = '9.9.9.9'
    for (let i = 0; i < 5; i++) {
      await POST(makeReq({ email: 'victim@b.com', password: 'wrong' }, ip))
    }
    // mesmo par IP+email, mas agora com senha correta — ainda bloqueado
    mockCompare.mockResolvedValue(true)
    const res = await POST(makeReq({ email: 'victim@b.com', password: 'correct' }, ip))
    expect(res.status).toBe(429)
  })
})
