// src/server/actions/plans-bonus.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetServerUser, mockSelectPlan, mockFindUserById, mockSupabaseUpdate, mockRedirect, mockMarkFeedbackUpgrade } = vi.hoisted(() => ({
  mockGetServerUser: vi.fn(),
  mockSelectPlan: vi.fn(),
  mockFindUserById: vi.fn(),
  mockSupabaseUpdate: vi.fn(),
  mockRedirect: vi.fn(),
  mockMarkFeedbackUpgrade: vi.fn(),
}))

vi.mock('@/server/services/session', () => ({ getServerUser: mockGetServerUser }))
vi.mock('@/server/repositories/plans', () => ({ PlanRepository: { selectPlan: mockSelectPlan } }))
vi.mock('@/server/repositories/users', () => ({ findUserById: mockFindUserById }))
vi.mock('@/server/actions/feedback', () => ({ markFeedbackUpgrade: mockMarkFeedbackUpgrade }))
vi.mock('next/navigation', () => ({ redirect: mockRedirect }))
vi.mock('@/server/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: mockSupabaseUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })),
  },
}))

import { selectPlanAction } from './plans'

describe('selectPlanAction — bonus_credits', () => {
  beforeEach(() => vi.clearAllMocks())

  it('move creditos restantes do experimental para bonus_credits', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1' })
    mockFindUserById.mockResolvedValue({
      planId: 'experimental',
      creditsRemaining: 3,
    })
    mockSelectPlan.mockResolvedValue(undefined)

    await selectPlanAction('profissional')

    expect(mockSupabaseUpdate).toHaveBeenCalledWith({ bonus_credits: 3 })
    expect(mockMarkFeedbackUpgrade).toHaveBeenCalledWith(undefined, 'upgrade_organic')
  })

  it('nao move bonus quando plano nao é experimental', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1' })
    mockFindUserById.mockResolvedValue({
      planId: 'profissional',
      creditsRemaining: 10,
    })
    mockSelectPlan.mockResolvedValue(undefined)

    await selectPlanAction('profissional-plus')

    expect(mockSupabaseUpdate).not.toHaveBeenCalled()
  })

  it('nao move bonus quando nao ha creditos restantes', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1' })
    mockFindUserById.mockResolvedValue({
      planId: 'experimental',
      creditsRemaining: 0,
    })
    mockSelectPlan.mockResolvedValue(undefined)

    await selectPlanAction('profissional')

    expect(mockSupabaseUpdate).not.toHaveBeenCalled()
  })
})
