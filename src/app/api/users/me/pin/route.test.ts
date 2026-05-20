// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetServerUser, mockHashPassword, mockUpdateUser } = vi.hoisted(() => ({
  mockGetServerUser: vi.fn(),
  mockHashPassword:  vi.fn(),
  mockUpdateUser:    vi.fn(),
}))

vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => ({
      json: async () => data,
      status: init?.status ?? 200,
    }),
  },
}))

vi.mock('@/server/services/session', () => ({ getServerUser: mockGetServerUser }))
vi.mock('@/server/services/auth',    () => ({ hashPassword: mockHashPassword }))
vi.mock('@/server/repositories/users', () => ({ updateUser: mockUpdateUser }))

import { PATCH } from './route'

function makeReq(body: object) {
  return { json: async () => body } as never
}

describe('PATCH /api/users/me/pin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetServerUser.mockResolvedValue({ sub: 'u1', role: 'user' })
    mockHashPassword.mockResolvedValue('$2b$12$hashed')
    mockUpdateUser.mockResolvedValue(undefined)
  })

  it('returns 401 when not authenticated', async () => {
    mockGetServerUser.mockResolvedValue(null)
    const res = await PATCH(makeReq({ pin: '123456', confirmPin: '123456' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when pin format is invalid', async () => {
    const res = await PATCH(makeReq({ pin: 'abc', confirmPin: 'abc' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when pins do not match', async () => {
    const res = await PATCH(makeReq({ pin: '123456', confirmPin: '654321' }))
    expect(res.status).toBe(400)
  })

  it('hashes and saves the pin on valid input', async () => {
    const res = await PATCH(makeReq({ pin: '695812', confirmPin: '695812' }))
    expect(res.status).toBe(200)
    expect(mockHashPassword).toHaveBeenCalledWith('695812')
    expect(mockUpdateUser).toHaveBeenCalledWith('u1', { pinHash: '$2b$12$hashed', pinIsTemp: false })
  })
})
