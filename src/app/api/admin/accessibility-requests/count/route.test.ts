// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetServerUser, mockCountPending } = vi.hoisted(() => ({
  mockGetServerUser: vi.fn(),
  mockCountPending: vi.fn(),
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
vi.mock('@/server/repositories/accessibility-requests', () => ({
  countPending: mockCountPending,
}))

import { GET } from './route'

describe('GET /api/admin/accessibility-requests/count', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejeita 401 quando nao autenticado', async () => {
    mockGetServerUser.mockResolvedValue(null)

    const res = await GET()

    expect(res.status).toBe(401)
    expect(mockCountPending).not.toHaveBeenCalled()
  })

  it('rejeita 403 quando role e user (nao admin/master)', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1', role: 'user' })

    const res = await GET()

    expect(res.status).toBe(403)
    expect(mockCountPending).not.toHaveBeenCalled()
  })

  it('retorna count quando admin', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1', role: 'admin' })
    mockCountPending.mockResolvedValue(7)

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ count: 7 })
  })

  it('retorna count quando master', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1', role: 'master' })
    mockCountPending.mockResolvedValue(0)

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ count: 0 })
  })
})
