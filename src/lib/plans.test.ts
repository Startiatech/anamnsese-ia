import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSelect, mockEq, mockOrder, mockSingle, mockUpdate } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockEq: vi.fn(),
  mockOrder: vi.fn(),
  mockSingle: vi.fn(),
  mockUpdate: vi.fn(),
}))

vi.mock('@/server/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect.mockReturnThis(),
      eq: mockEq.mockReturnThis(),
      order: mockOrder,
      single: mockSingle,
      update: mockUpdate.mockReturnThis(),
    })),
  },
}))

import { PlanRepository } from './plans'

beforeEach(() => vi.clearAllMocks())

describe('PlanRepository.listActive', () => {
  it('returns only active plans ordered by sort_order', async () => {
    const rows = [
      { id: 'experimental', name: 'Experimental', description: 'desc', price: 0, quota: 10, active: true, features: [], sort_order: 1 },
    ]
    mockOrder.mockResolvedValueOnce({ data: rows, error: null })
    const result = await PlanRepository.listActive()
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('experimental')
    expect(mockEq).toHaveBeenCalledWith('active', true)
  })

  it('returns empty array when no active plans', async () => {
    mockOrder.mockResolvedValueOnce({ data: [], error: null })
    expect(await PlanRepository.listActive()).toEqual([])
  })
})

describe('PlanRepository.getUserPlan', () => {
  it('returns planId and planSelected=true when user has selected a plan', async () => {
    mockSingle.mockResolvedValueOnce({ data: { plan_id: 'profissional', plan_selected: true }, error: null })
    const result = await PlanRepository.getUserPlan('user-1')
    expect(result).toEqual({ planId: 'profissional', planSelected: true })
    expect(mockEq).toHaveBeenCalledWith('id', 'user-1')
  })

  it('returns experimental planId and planSelected=false when user has not selected', async () => {
    mockSingle.mockResolvedValueOnce({ data: { plan_id: 'experimental', plan_selected: false }, error: null })
    const result = await PlanRepository.getUserPlan('user-1')
    expect(result).toEqual({ planId: 'experimental', planSelected: false })
  })

  it('returns experimental fallback when data is null', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null })
    const result = await PlanRepository.getUserPlan('user-1')
    expect(result).toEqual({ planId: 'experimental', planSelected: false })
  })
})

describe('PlanRepository.selectPlan', () => {
  it('busca a quota do plano e atualiza plan_id, plan_selected e credits_remaining', async () => {
    mockSelect.mockReturnThis()
    mockEq.mockReturnThis()
    mockUpdate.mockReturnThis()
    mockSingle.mockResolvedValueOnce({ data: { quota: 30 }, error: null })

    await PlanRepository.selectPlan('user-1', 'profissional')

    expect(mockUpdate).toHaveBeenCalledWith({
      plan_id: 'profissional',
      plan_selected: true,
      credits_remaining: 30,
    })
  })

  it('reseta credits_remaining para 0 quando o plano nao tem quota', async () => {
    mockSelect.mockReturnThis()
    mockEq.mockReturnThis()
    mockUpdate.mockReturnThis()
    mockSingle.mockResolvedValueOnce({ data: null, error: null })

    await PlanRepository.selectPlan('user-1', 'inexistente')

    expect(mockUpdate).toHaveBeenCalledWith({
      plan_id: 'inexistente',
      plan_selected: true,
      credits_remaining: 0,
    })
  })
})
