// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetServerUser, mockFindLatest } = vi.hoisted(() => ({
  mockGetServerUser: vi.fn(),
  mockFindLatest: vi.fn(),
}))

vi.mock('@/server/services/session', () => ({
  getServerUser: mockGetServerUser,
}))

vi.mock('@/server/repositories/db', () => ({
  ConsultationRepository: {
    findLatestByPatientId: mockFindLatest,
  },
}))

vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => ({
      json: async () => data,
      status: init?.status ?? 200,
    }),
  },
}))

import { GET } from './route'

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) }
}

const mockConsultation = {
  id: 'cons-1',
  patientId: 'patient-1',
  userId: 'user-1',
  status: 'completed',
  structuredAnamnesis: {
    sections: [
      { title: 'Queixa principal', content: 'Cefaleia há 3 dias.' },
    ],
  },
}

describe('GET /api/patients/[id]/latest-consultation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetServerUser.mockResolvedValue({ sub: 'user-1' })
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetServerUser.mockResolvedValue(null)
    const res = await GET({} as never, makeParams('patient-1'))
    expect(res.status).toBe(401)
  })

  it('returns 404 when no consultation found', async () => {
    mockFindLatest.mockResolvedValue(null)
    const res = await GET({} as never, makeParams('patient-1'))
    expect(res.status).toBe(404)
  })

  it('returns 200 with consultation data when found', async () => {
    mockFindLatest.mockResolvedValue(mockConsultation)
    const res = await GET({} as never, makeParams('patient-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(mockConsultation)
  })

  it('calls findLatestByPatientId with correct user and patient ids', async () => {
    mockFindLatest.mockResolvedValue(mockConsultation)
    await GET({} as never, makeParams('patient-1'))
    expect(mockFindLatest).toHaveBeenCalledWith('user-1', 'patient-1')
  })
})
