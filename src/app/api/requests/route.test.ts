// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockGetServerUser,
  mockListRequests,
  mockFindRequestByEmail,
  mockFindUserByEmail,
  mockCheckDuplicateRequest,
  mockAddRequest,
} = vi.hoisted(() => ({
  mockGetServerUser: vi.fn(),
  mockListRequests: vi.fn(),
  mockFindRequestByEmail: vi.fn(),
  mockFindUserByEmail: vi.fn(),
  mockCheckDuplicateRequest: vi.fn(),
  mockAddRequest: vi.fn(),
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
vi.mock('@/lib/requests', () => ({
  addRequest: mockAddRequest,
  listRequests: mockListRequests,
  findRequestByEmail: mockFindRequestByEmail,
}))
vi.mock('@/lib/request-policy', () => ({ checkDuplicateRequest: mockCheckDuplicateRequest }))
vi.mock('@/server/repositories/users', () => ({ findUserByEmail: mockFindUserByEmail }))

import { GET } from './route'

function makeReq(url: string) {
  return { url } as unknown as Request
}

describe('GET /api/requests', () => {
  beforeEach(() => vi.clearAllMocks())

  // Branch publico: lookup por email (usado pelo formulario publico) — sem auth
  it('lookup por email continua publico (sem auth)', async () => {
    mockGetServerUser.mockResolvedValue(null)
    mockFindRequestByEmail.mockResolvedValue(null)
    mockCheckDuplicateRequest.mockReturnValue(null)

    const res = await GET(makeReq('http://x/api/requests?email=a@b.com'))

    expect(res.status).toBe(200)
    expect(mockListRequests).not.toHaveBeenCalled()
  })

  // Branch sensivel: listar todas as solicitacoes (PII) — exige admin/master
  it('rejeita 401 ao listar todas sem autenticacao', async () => {
    mockGetServerUser.mockResolvedValue(null)

    const res = await GET(makeReq('http://x/api/requests'))

    expect(res.status).toBe(401)
    expect(mockListRequests).not.toHaveBeenCalled()
  })

  it('rejeita 403 ao listar todas como user comum', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1', role: 'user' })

    const res = await GET(makeReq('http://x/api/requests'))

    expect(res.status).toBe(403)
    expect(mockListRequests).not.toHaveBeenCalled()
  })

  it('lista todas quando admin', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'a1', role: 'admin' })
    mockListRequests.mockResolvedValue([{ id: 'r1' }])

    const res = await GET(makeReq('http://x/api/requests'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ requests: [{ id: 'r1' }] })
  })

  it('lista todas quando master', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'm1', role: 'master' })
    mockListRequests.mockResolvedValue([])

    const res = await GET(makeReq('http://x/api/requests'))

    expect(res.status).toBe(200)
    expect(mockListRequests).toHaveBeenCalled()
  })
})
