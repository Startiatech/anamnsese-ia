// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockGetServerUser,
  mockFindRequestById,
  mockFindUserByEmail,
  mockUpdateUser,
  mockHashPassword,
  mockGenerateTempPassword,
} = vi.hoisted(() => ({
  mockGetServerUser: vi.fn(),
  mockFindRequestById: vi.fn(),
  mockFindUserByEmail: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockHashPassword: vi.fn(),
  mockGenerateTempPassword: vi.fn(),
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
vi.mock('@/server/services/auth', () => ({ hashPassword: mockHashPassword }))
vi.mock('@/lib/temp-password', () => ({ generateTempPassword: mockGenerateTempPassword }))
vi.mock('@/server/repositories/requests', () => ({ findRequestById: mockFindRequestById }))
vi.mock('@/server/repositories/users', () => ({
  findUserByEmail: mockFindUserByEmail,
  updateUser: mockUpdateUser,
}))

import { POST } from './route'

function makeCtx(id: string) {
  return { params: Promise.resolve({ id }) }
}
const req = {} as Request

const approvedRequest = {
  id: 'r1', name: 'Dr. Ana', email: 'ana@b.com', phone: '5511999', status: 'approved',
}

describe('POST /api/admin/requests/[id]/view-credentials (regenera)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetServerUser.mockResolvedValue({ sub: 'a1', role: 'admin' })
    mockFindRequestById.mockResolvedValue(approvedRequest)
    mockFindUserByEmail.mockResolvedValue({ id: 'u1', email: 'ana@b.com', passwordIsTemp: true })
    mockGenerateTempPassword.mockReturnValue('abcdef0123456789')
    mockHashPassword.mockResolvedValue('$2b$12$newhash')
    mockUpdateUser.mockResolvedValue(undefined)
  })

  it('rejeita 401 sem sessao', async () => {
    mockGetServerUser.mockResolvedValue(null)
    const res = await POST(req, makeCtx('r1'))
    expect(res.status).toBe(401)
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it('rejeita 403 para role user', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u9', role: 'user' })
    const res = await POST(req, makeCtx('r1'))
    expect(res.status).toBe(403)
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it('404 quando solicitacao nao existe', async () => {
    mockFindRequestById.mockResolvedValue(undefined)
    const res = await POST(req, makeCtx('rX'))
    expect(res.status).toBe(404)
  })

  it('400 quando solicitacao nao aprovada', async () => {
    mockFindRequestById.mockResolvedValue({ ...approvedRequest, status: 'pending' })
    const res = await POST(req, makeCtx('r1'))
    expect(res.status).toBe(400)
  })

  it('404 quando usuario associado nao encontrado', async () => {
    mockFindUserByEmail.mockResolvedValue(undefined)
    const res = await POST(req, makeCtx('r1'))
    expect(res.status).toBe(404)
  })

  it('410 quando usuario ja definiu a propria senha (passwordIsTemp false)', async () => {
    mockFindUserByEmail.mockResolvedValue({ id: 'u1', email: 'ana@b.com', passwordIsTemp: false })
    const res = await POST(req, makeCtx('r1'))
    expect(res.status).toBe(410)
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it('200: gera nova senha, persiste só o hash e retorna o plaintext uma vez', async () => {
    const res = await POST(req, makeCtx('r1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.password).toBe('abcdef0123456789')
    expect(json.email).toBe('ana@b.com')
    expect(mockHashPassword).toHaveBeenCalledWith('abcdef0123456789')
    expect(mockUpdateUser).toHaveBeenCalledWith('u1', {
      passwordHash: '$2b$12$newhash',
      passwordIsTemp: true,
    })
  })

  it('master tambem autorizado', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'm1', role: 'master' })
    const res = await POST(req, makeCtx('r1'))
    expect(res.status).toBe(200)
  })
})
