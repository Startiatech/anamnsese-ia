// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }))

vi.mock('@/server/supabase', () => ({
  supabase: { from: mockFrom },
}))

import { ConsultationRepository } from './db'

function makeChain(resolveValue: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'not', 'order', 'limit', 'maybeSingle']
  for (const m of methods) {
    chain[m] = vi.fn(() => chain)
  }
  Object.defineProperty(chain, 'then', {
    value: (resolve: (v: unknown) => unknown) => Promise.resolve(resolveValue).then(resolve),
  })
  return chain
}

describe('ConsultationRepository.findLatestByPatientId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('filtra por structured_anamnesis not null (nunca retorna atendimento abandonado)', async () => {
    const chain = makeChain({ data: null })
    mockFrom.mockReturnValue(chain)

    await ConsultationRepository.findLatestByPatientId('u1', 'p1')

    expect(chain.not).toHaveBeenCalledWith('structured_anamnesis', 'is', null)
  })

  it('retorna null quando não há consulta com anamnese', async () => {
    const chain = makeChain({ data: null })
    mockFrom.mockReturnValue(chain)

    const result = await ConsultationRepository.findLatestByPatientId('u1', 'p1')
    expect(result).toBeNull()
  })

  it('mapeia a consulta quando existe anamnese gerada', async () => {
    const chain = makeChain({
      data: {
        id: 'c1',
        patient_id: 'p1',
        raw_transcript: null,
        structured_anamnesis: { sections: [] },
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
      },
    })
    mockFrom.mockReturnValue(chain)

    const result = await ConsultationRepository.findLatestByPatientId('u1', 'p1')
    expect(result?.id).toBe('c1')
  })
})
