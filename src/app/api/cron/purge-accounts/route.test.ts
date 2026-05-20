// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockFindUsersScheduledForDeletion, mockDeleteUser } = vi.hoisted(() => ({
  mockFindUsersScheduledForDeletion: vi.fn(),
  mockDeleteUser: vi.fn(),
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
  findUsersScheduledForDeletion: mockFindUsersScheduledForDeletion,
  deleteUser: mockDeleteUser,
}))

import { GET } from './route'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(secret?: string) {
  const headers = new Map<string, string>()
  if (secret) headers.set('authorization', `Bearer ${secret}`)
  return { headers: { get: (k: string) => headers.get(k) ?? null } } as never
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GET /api/cron/purge-accounts', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...ORIGINAL_ENV, CRON_SECRET: 'test-secret' }
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  it('retorna 401 sem Authorization header', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('retorna 401 com secret incorreto', async () => {
    const res = await GET(makeRequest('wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('purga usuários vencidos e retorna contagem', async () => {
    mockFindUsersScheduledForDeletion.mockResolvedValue([
      { id: 'u1' },
      { id: 'u2' },
    ])
    mockDeleteUser.mockResolvedValue(undefined)

    const res = await GET(makeRequest('test-secret'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ purged: 2 })
    expect(mockDeleteUser).toHaveBeenCalledTimes(2)
    expect(mockDeleteUser).toHaveBeenCalledWith('u1')
    expect(mockDeleteUser).toHaveBeenCalledWith('u2')
  })

  it('retorna purged: 0 quando não há usuários a purgar', async () => {
    mockFindUsersScheduledForDeletion.mockResolvedValue([])
    const res = await GET(makeRequest('test-secret'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ purged: 0 })
    expect(mockDeleteUser).not.toHaveBeenCalled()
  })

  it('retorna 500 em caso de erro interno', async () => {
    mockFindUsersScheduledForDeletion.mockRejectedValue(new Error('db error'))
    const res = await GET(makeRequest('test-secret'))
    expect(res.status).toBe(500)
  })
})
