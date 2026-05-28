// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }))

vi.mock('@/server/supabase', () => ({
  supabase: { from: mockFrom },
}))

import { PatientRepository } from './db'

function makeChain(resolveValue: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'order', 'limit', 'single']
  for (const m of methods) {
    chain[m] = vi.fn(() => chain)
  }
  // Make the chain thenable so it can be awaited
  Object.defineProperty(chain, 'then', {
    value: (resolve: (v: unknown) => unknown) => Promise.resolve(resolveValue).then(resolve),
  })
  return chain
}

const patientRow = {
  id: 'patient-1',
  name: 'Ana',
  cpf: '123',
  birth_date: '1990-01-01',
  phone: '99999',
  created_at: '2026-01-01T00:00:00Z',
  consultations: [{ count: 2 }],
}

const patientRowNoConsultations = {
  id: 'patient-2',
  name: 'Bob',
  cpf: '456',
  birth_date: null,
  phone: null,
  created_at: '2026-01-02T00:00:00Z',
  consultations: [{ count: 0 }],
}

describe('PatientRepository.findAllWithStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns consultationCount and lastConsultationAt for patient with consultations', async () => {
    // First call: patients query
    const patientsChain = makeChain({ data: [patientRow] })
    // Second call: consultations query
    const consultationsChain = makeChain({
      data: [
        { patient_id: 'patient-1', created_at: '2026-03-01T00:00:00Z' },
        { patient_id: 'patient-1', created_at: '2026-01-15T00:00:00Z' },
      ],
    })

    mockFrom
      .mockReturnValueOnce(patientsChain)
      .mockReturnValueOnce(consultationsChain)

    const result = await PatientRepository.findAllWithStats('user-1')

    expect(result).toHaveLength(1)
    expect(result[0].consultationCount).toBe(2)
    expect(result[0].lastConsultationAt).toBe('2026-03-01T00:00:00Z')
  })

  it('returns consultationCount=0 and lastConsultationAt=undefined for patient with no consultations', async () => {
    const patientsChain = makeChain({ data: [patientRowNoConsultations] })
    const consultationsChain = makeChain({ data: [] })

    mockFrom
      .mockReturnValueOnce(patientsChain)
      .mockReturnValueOnce(consultationsChain)

    const result = await PatientRepository.findAllWithStats('user-1')

    expect(result).toHaveLength(1)
    expect(result[0].consultationCount).toBe(0)
    expect(result[0].lastConsultationAt).toBeUndefined()
  })

  it('returns empty array when no patients', async () => {
    const patientsChain = makeChain({ data: [] })
    const consultationsChain = makeChain({ data: [] })

    mockFrom
      .mockReturnValueOnce(patientsChain)
      .mockReturnValueOnce(consultationsChain)

    const result = await PatientRepository.findAllWithStats('user-1')

    expect(result).toHaveLength(0)
  })

  it('marks hasAnamnesis true when a consultation has structured_anamnesis', async () => {
    const patientsChain = makeChain({ data: [patientRow] })
    const consultationsChain = makeChain({
      data: [
        { patient_id: 'patient-1', created_at: '2026-03-01T00:00:00Z', structured_anamnesis: { sections: [] } },
      ],
    })
    mockFrom.mockReturnValueOnce(patientsChain).mockReturnValueOnce(consultationsChain)

    const result = await PatientRepository.findAllWithStats('user-1')
    expect(result[0].hasAnamnesis).toBe(true)
  })

  it('marks hasAnamnesis false when consultations have null structured_anamnesis (abandonado)', async () => {
    const patientsChain = makeChain({ data: [patientRow] })
    const consultationsChain = makeChain({
      data: [
        { patient_id: 'patient-1', created_at: '2026-03-01T00:00:00Z', structured_anamnesis: null },
      ],
    })
    mockFrom.mockReturnValueOnce(patientsChain).mockReturnValueOnce(consultationsChain)

    const result = await PatientRepository.findAllWithStats('user-1')
    expect(result[0].hasAnamnesis).toBe(false)
  })

  it('uses first (most recent) consultation date from ordered results', async () => {
    const patientsChain = makeChain({ data: [patientRow] })
    // ordered by created_at desc — first is the most recent
    const consultationsChain = makeChain({
      data: [
        { patient_id: 'patient-1', created_at: '2026-04-01T00:00:00Z' },
        { patient_id: 'patient-1', created_at: '2026-02-01T00:00:00Z' },
      ],
    })

    mockFrom
      .mockReturnValueOnce(patientsChain)
      .mockReturnValueOnce(consultationsChain)

    const result = await PatientRepository.findAllWithStats('user-1')

    expect(result[0].lastConsultationAt).toBe('2026-04-01T00:00:00Z')
  })
})
