import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSelect, mockEq, mockSingle, mockUpdate, mockUpdateEq, fromSpy } = vi.hoisted(() => {
  const mockSelect = vi.fn()
  const mockEq = vi.fn()
  const mockSingle = vi.fn()
  const mockUpdate = vi.fn()
  const mockUpdateEq = vi.fn()
  const fromSpy = vi.fn()
  return { mockSelect, mockEq, mockSingle, mockUpdate, mockUpdateEq, fromSpy }
})

vi.mock('@/server/supabase', () => ({
  supabase: {
    from: (table: string) => {
      fromSpy(table)
      if (table === 'plans') {
        return {
          select: mockSelect.mockReturnValue({
            eq: mockEq.mockReturnValue({ single: mockSingle }),
          }),
        }
      }
      // users
      return {
        update: mockUpdate.mockReturnValue({ eq: mockUpdateEq }),
      }
    },
  },
}))

import { PlanRepository } from './plans'

describe('PlanRepository.selectPlan', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reseta credits_remaining para a quota do novo plano', async () => {
    mockSingle.mockResolvedValueOnce({ data: { quota: 30 }, error: null })
    mockUpdateEq.mockResolvedValueOnce({ error: null })

    await PlanRepository.selectPlan('u1', 'profissional')

    expect(mockUpdate).toHaveBeenCalledWith({
      plan_id: 'profissional',
      plan_selected: true,
      credits_remaining: 30,
    })
  })

  it('reseta para 0 quando plano nao retorna quota', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null })
    mockUpdateEq.mockResolvedValueOnce({ error: null })

    await PlanRepository.selectPlan('u1', 'inexistente')

    expect(mockUpdate).toHaveBeenCalledWith({
      plan_id: 'inexistente',
      plan_selected: true,
      credits_remaining: 0,
    })
  })
})
