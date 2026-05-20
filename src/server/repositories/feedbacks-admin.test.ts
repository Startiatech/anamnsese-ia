// src/server/repositories/feedbacks-admin.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}))

vi.mock('@/server/supabase', () => ({
  supabase: { from: mockFrom },
}))

import { FeedbackRepository } from './feedbacks'

describe('FeedbackRepository — admin queries', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('listAll', () => {
    it('retorna lista paginada de feedbacks', async () => {
      const rows = [
        {
          id: 'fb-1', user_id: 'u1', rating: 5,
          message: 'Excelente', plan_id: 'experimental',
          action_taken: 'upgrade_modal', sentiment_score: null,
          sentiment_label: null, analyzed_at: null,
          created_at: '2026-04-10T00:00:00Z',
          users: { name: 'Dr. Ana', email: 'ana@clinic.com', phone: '11999999999' },
        },
      ]
      const chain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: rows, error: null }),
      }
      mockFrom.mockReturnValue(chain)

      const result = await FeedbackRepository.listAll({ page: 0, pageSize: 20 })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('fb-1')
      expect(result[0].userName).toBe('Dr. Ana')
    })
  })

  describe('getMetrics', () => {
    it('calcula metricas corretamente sem pending', async () => {
      const rows = [
        { rating: 5, action_taken: 'upgrade_modal' },
        { rating: 3, action_taken: 'declined' },
        { rating: 4, action_taken: 'upgrade_organic' },
      ]
      const chain = {
        select: vi.fn().mockResolvedValue({ data: rows, error: null }),
      }
      mockFrom.mockReturnValue(chain)

      const metrics = await FeedbackRepository.getMetrics()
      expect(metrics.avgRating).toBeCloseTo(4)
      expect(metrics.totalUpgrades).toBe(2)
      expect(metrics.totalChurn).toBe(1)
      expect(metrics.conversionRate).toBeCloseTo(66.67, 1)
    })

    it('exclui pending do cálculo de avgRating', async () => {
      const rows = [
        { rating: 5, action_taken: 'upgrade_modal' },
        { rating: 1, action_taken: 'pending' }, // não deve entrar na média
        { rating: 3, action_taken: 'declined' },
      ]
      const chain = {
        select: vi.fn().mockResolvedValue({ data: rows, error: null }),
      }
      mockFrom.mockReturnValue(chain)

      const metrics = await FeedbackRepository.getMetrics()
      // média só de upgrade_modal(5) e declined(3) = 4.0, pending excluído
      expect(metrics.avgRating).toBeCloseTo(4)
      expect(metrics.totalUpgrades).toBe(1)
      expect(metrics.totalChurn).toBe(1)
    })
  })

})
