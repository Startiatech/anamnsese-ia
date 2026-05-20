// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest'
import { PlanRepository } from './plans'
import { seedUser, cleanupUser } from '@/tests/integration/seed'

describe('PlanRepository (integration)', () => {
  const created: string[] = []

  afterEach(async () => {
    for (const id of created.splice(0)) await cleanupUser(id)
  })

  describe('listActive', () => {
    it('returns at least one active plan', async () => {
      const plans = await PlanRepository.listActive()
      expect(plans.length).toBeGreaterThan(0)
    })

    it('every returned plan has active=true', async () => {
      const plans = await PlanRepository.listActive()
      expect(plans.every((p) => p.active)).toBe(true)
    })

    it('plans are sorted by sort_order ascending', async () => {
      const plans = await PlanRepository.listActive()
      const orders = plans.map((p) => p.sort_order)
      expect(orders).toEqual([...orders].sort((a, b) => a - b))
    })

    it('experimental plan exists in active list', async () => {
      const plans = await PlanRepository.listActive()
      expect(plans.some((p) => p.id === 'experimental')).toBe(true)
    })
  })

  describe('getUserPlan', () => {
    it('returns experimental fallback for a new user', async () => {
      const user = await seedUser({ plan_id: 'experimental', plan_selected: false })
      created.push(user.id)
      const result = await PlanRepository.getUserPlan(user.id)
      expect(result.planId).toBe('experimental')
      expect(result.planSelected).toBe(false)
    })
  })

  describe('selectPlan', () => {
    it('updates plan_id and plan_selected to true', async () => {
      const user = await seedUser({ plan_id: 'experimental', plan_selected: false })
      created.push(user.id)
      await PlanRepository.selectPlan(user.id, 'experimental')
      const result = await PlanRepository.getUserPlan(user.id)
      expect(result.planId).toBe('experimental')
      expect(result.planSelected).toBe(true)
    })
  })

  describe('getQuotaByPlanId', () => {
    it('returns quota for experimental plan', async () => {
      const quota = await PlanRepository.getQuotaByPlanId('experimental')
      expect(typeof quota).toBe('number')
      expect(quota).toBeGreaterThanOrEqual(0)
    })
  })
})
