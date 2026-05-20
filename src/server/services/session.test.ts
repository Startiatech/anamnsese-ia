// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetCookies, mockVerifyToken, mockFindUserById } = vi.hoisted(() => ({
  mockGetCookies: vi.fn(),
  mockVerifyToken: vi.fn(),
  mockFindUserById: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: mockGetCookies,
}))
vi.mock('@/server/services/auth', () => ({
  verifyToken: mockVerifyToken,
  COOKIE_NAME: 'anamnese_auth',
}))
vi.mock('@/server/repositories/users', () => ({
  findUserById: mockFindUserById,
}))

import { requireActiveUser } from './session'

const mockPayload = { sub: 'u1', email: 'a@b.com', name: 'A', role: 'user' as const }

beforeEach(() => {
  vi.clearAllMocks()
  mockGetCookies.mockResolvedValue({ get: () => ({ value: 'token123' }) })
  mockVerifyToken.mockResolvedValue(mockPayload)
})

describe('requireActiveUser', () => {
  it('retorna null quando não há token', async () => {
    mockGetCookies.mockResolvedValue({ get: () => undefined })
    expect(await requireActiveUser()).toBeNull()
  })

  it('retorna null quando token inválido', async () => {
    mockVerifyToken.mockResolvedValue(null)
    expect(await requireActiveUser()).toBeNull()
  })

  it('retorna null quando usuário não existe no banco', async () => {
    mockFindUserById.mockResolvedValue(undefined)
    expect(await requireActiveUser()).toBeNull()
  })

  it('retorna null quando usuário está bloqueado', async () => {
    mockFindUserById.mockResolvedValue({ id: 'u1', blocked: true })
    expect(await requireActiveUser()).toBeNull()
  })

  it('retorna o payload JWT quando usuário está ativo', async () => {
    mockFindUserById.mockResolvedValue({ id: 'u1', blocked: false })
    const result = await requireActiveUser()
    expect(result).toEqual(mockPayload)
    expect(mockFindUserById).toHaveBeenCalledWith('u1')
  })
})
