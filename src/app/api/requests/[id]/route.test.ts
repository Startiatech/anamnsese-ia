// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetServerUser, mockUpdateRequestStatus } = vi.hoisted(() => ({
  mockGetServerUser: vi.fn(),
  mockUpdateRequestStatus: vi.fn(),
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
vi.mock('@/lib/requests', () => ({ updateRequestStatus: mockUpdateRequestStatus }))

import { PATCH } from './route'

function makeReq(body: unknown) {
  return { json: async () => body } as unknown as Request
}

const props = { params: Promise.resolve({ id: 'req-1' }) }

describe('PATCH /api/requests/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejeita 401 quando nao autenticado', async () => {
    mockGetServerUser.mockResolvedValue(null)

    const res = await PATCH(makeReq({ status: 'approved' }), props)

    expect(res.status).toBe(401)
    expect(mockUpdateRequestStatus).not.toHaveBeenCalled()
  })

  it('rejeita 403 quando role e user (nao admin/master)', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1', role: 'user' })

    const res = await PATCH(makeReq({ status: 'approved' }), props)

    expect(res.status).toBe(403)
    expect(mockUpdateRequestStatus).not.toHaveBeenCalled()
  })

  it('rejeita 400 para status invalido (admin autenticado)', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'a1', role: 'admin' })

    const res = await PATCH(makeReq({ status: 'banana' }), props)

    expect(res.status).toBe(400)
    expect(mockUpdateRequestStatus).not.toHaveBeenCalled()
  })

  it('aprova quando admin', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'a1', role: 'admin' })
    mockUpdateRequestStatus.mockResolvedValue(true)

    const res = await PATCH(makeReq({ status: 'approved' }), props)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ ok: true })
    expect(mockUpdateRequestStatus).toHaveBeenCalledWith('req-1', 'approved')
  })

  it('aprova quando master', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'm1', role: 'master' })
    mockUpdateRequestStatus.mockResolvedValue(true)

    const res = await PATCH(makeReq({ status: 'rejected' }), props)

    expect(res.status).toBe(200)
    expect(mockUpdateRequestStatus).toHaveBeenCalledWith('req-1', 'rejected')
  })

  it('retorna 404 quando solicitacao nao existe', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'a1', role: 'admin' })
    mockUpdateRequestStatus.mockResolvedValue(false)

    const res = await PATCH(makeReq({ status: 'approved' }), props)

    expect(res.status).toBe(404)
  })
})
