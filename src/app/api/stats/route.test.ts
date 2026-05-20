// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockCountRegisteredUsers } = vi.hoisted(() => ({
  mockCountRegisteredUsers: vi.fn(),
}))

vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => ({
      json: async () => data,
      status: init?.status ?? 200,
    }),
  },
}))

vi.mock('@/server/repositories/users', () => ({
  countRegisteredUsers: mockCountRegisteredUsers,
}))

import { GET } from './route'

describe('GET /api/stats', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna count de todos os usuários registrados', async () => {
    mockCountRegisteredUsers.mockResolvedValue(5)

    const res = await GET()
    const body = await res.json()

    expect(body).toEqual({ count: 5 })
    expect(res.status).toBe(200)
    expect(mockCountRegisteredUsers).toHaveBeenCalledOnce()
  })

  it('retorna count 0 quando não há usuários', async () => {
    mockCountRegisteredUsers.mockResolvedValue(0)

    const res = await GET()
    const body = await res.json()

    expect(body).toEqual({ count: 0 })
  })

  it('retorna 500 quando a query falha', async () => {
    mockCountRegisteredUsers.mockRejectedValue(new Error('db error'))

    const res = await GET()

    expect(res.status).toBe(500)
  })
})
