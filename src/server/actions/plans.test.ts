// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetServerUser, mockSelectPlan, mockRedirect } = vi.hoisted(() => ({
  mockGetServerUser: vi.fn(),
  mockSelectPlan: vi.fn(),
  mockRedirect: vi.fn(),
}))

vi.mock('@/server/services/session', () => ({ getServerUser: mockGetServerUser }))
vi.mock('@/server/repositories/plans', () => ({ PlanRepository: { selectPlan: mockSelectPlan } }))
vi.mock('next/navigation', () => ({ redirect: mockRedirect }))
vi.mock('@/server/supabase', () => ({
  supabase: { from: vi.fn(() => ({ update: vi.fn().mockReturnThis(), insert: vi.fn().mockReturnThis(), delete: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }), select: vi.fn().mockReturnThis(), single: vi.fn() })) },
}))

import { selectPlanAction } from './plans'

describe('selectPlanAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('chama PlanRepository.selectPlan com o planId fornecido', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1' })
    mockSelectPlan.mockResolvedValue(undefined)

    await selectPlanAction('profissional')

    expect(mockSelectPlan).toHaveBeenCalledWith('u1', 'profissional')
  })

  it('redireciona para login quando nao autenticado', async () => {
    mockGetServerUser.mockResolvedValue(null)
    mockRedirect.mockImplementation(() => { throw new Error('NEXT_REDIRECT') })

    await expect(selectPlanAction('profissional')).rejects.toThrow('NEXT_REDIRECT')

    expect(mockRedirect).toHaveBeenCalled()
    expect(mockSelectPlan).not.toHaveBeenCalled()
  })
})
