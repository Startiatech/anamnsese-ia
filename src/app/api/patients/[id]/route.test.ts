// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetServerUser, mockUpdate, mockDelete } = vi.hoisted(() => ({
  mockGetServerUser: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}))

vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => ({
      json: async () => data,
      status: init?.status ?? 200,
    }),
  },
  NextRequest: class {},
}))

vi.mock('@/server/services/session', () => ({ getServerUser: mockGetServerUser }))

vi.mock('@/server/repositories/db', () => ({
  PatientRepository: {
    findById: vi.fn(),
    update: mockUpdate,
    delete: mockDelete,
  },
}))

import { PATCH, DELETE } from './route'

function makeRequest(body: object) {
  return { json: async () => body } as never
}
const params = Promise.resolve({ id: 'patient-1' })

describe('PATCH /api/patients/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetServerUser.mockResolvedValue({ sub: 'user-1' })
    mockUpdate.mockResolvedValue(undefined)
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetServerUser.mockResolvedValue(null)
    const res = await PATCH(makeRequest({}), { params })
    expect(res.status).toBe(401)
  })

  it('calls PatientRepository.update with correct args and returns ok', async () => {
    const body = { name: 'Dr. Ana', cpf: '123.456.789-00', birthDate: '1990-01-01', phone: '11999' }
    const res = await PATCH(makeRequest(body), { params })
    const json = await res.json()
    expect(mockUpdate).toHaveBeenCalledWith('user-1', 'patient-1', body)
    expect(json).toEqual({ ok: true })
  })
})

describe('DELETE /api/patients/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetServerUser.mockResolvedValue({ sub: 'user-1' })
    mockDelete.mockResolvedValue(undefined)
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetServerUser.mockResolvedValue(null)
    const res = await DELETE({} as never, { params })
    expect(res.status).toBe(401)
  })

  it('calls PatientRepository.delete with correct args and returns ok', async () => {
    const res = await DELETE({} as never, { params })
    const json = await res.json()
    expect(mockDelete).toHaveBeenCalledWith('user-1', 'patient-1')
    expect(json).toEqual({ ok: true })
  })
})
