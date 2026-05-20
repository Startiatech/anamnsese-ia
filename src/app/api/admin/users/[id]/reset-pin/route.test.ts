// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockVerifyToken, mockFindUserById, mockHashPassword, mockUpdateUser } = vi.hoisted(() => ({
  mockVerifyToken:   vi.fn(),
  mockFindUserById:  vi.fn(),
  mockHashPassword:  vi.fn(),
  mockUpdateUser:    vi.fn(),
}))

vi.mock('@/server/services/auth', () => ({
  verifyToken:  mockVerifyToken,
  hashPassword: mockHashPassword,
  COOKIE_NAME:  'anamnese_auth',
}))

vi.mock('next/headers', () => ({
  cookies: () => ({ get: (_name: string) => ({ value: 'token' }) }),
}))

vi.mock('@/server/repositories/users', () => ({
  findUserById: mockFindUserById,
  updateUser:   mockUpdateUser,
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

function makeReq() {
  return {} as Request
}

function makeCtx(userId: string) {
  return { params: Promise.resolve({ id: userId }) }
}

const baseUser = {
  id: 'u1',
  name: 'Ana',
  email: 'ana@b.com',
  phone: '5511999999999',
  pinHash: '$2b$12$old',
  pinIsTemp: false,
}

describe('POST /api/admin/users/[id]/reset-pin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyToken.mockResolvedValue({ sub: 'admin1', role: 'admin' })
    mockFindUserById.mockResolvedValue(baseUser)
    mockHashPassword.mockResolvedValue('$2b$12$newhash')
    mockUpdateUser.mockResolvedValue(undefined)
  })

  it('returns 401 when not authenticated', async () => {
    mockVerifyToken.mockResolvedValue(null)
    const res = await POST(makeReq(), makeCtx('u1'))
    expect(res.status).toBe(401)
  })

  it('returns 403 when role is user', async () => {
    mockVerifyToken.mockResolvedValue({ sub: 'u2', role: 'user' })
    const res = await POST(makeReq(), makeCtx('u1'))
    expect(res.status).toBe(403)
  })

  it('returns 404 when user not found', async () => {
    mockFindUserById.mockResolvedValue(undefined)
    const res = await POST(makeReq(), makeCtx('unknown'))
    expect(res.status).toBe(404)
  })

  it('returns 200 with a 6-digit numeric pin', async () => {
    const res = await POST(makeReq(), makeCtx('u1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.pin).toMatch(/^\d{6}$/)
  })

  it('hashes the generated pin and saves to DB', async () => {
    await POST(makeReq(), makeCtx('u1'))
    expect(mockHashPassword).toHaveBeenCalledWith(expect.stringMatching(/^\d{6}$/))
    expect(mockUpdateUser).toHaveBeenCalledWith('u1', {
      pinHash:   '$2b$12$newhash',
      pinIsTemp: true,
    })
  })

  it('master role is also authorized', async () => {
    mockVerifyToken.mockResolvedValue({ sub: 'master1', role: 'master' })
    const res = await POST(makeReq(), makeCtx('u1'))
    expect(res.status).toBe(200)
  })
})
