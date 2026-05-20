// src/server/repositories/feedbacks.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}))

vi.mock('@/server/supabase', () => ({
  supabase: { from: mockFrom },
}))

import { FeedbackRepository } from './feedbacks'

describe('FeedbackRepository', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('save', () => {
    it('insere feedback e retorna id', async () => {
      const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'fb-1' }, error: null })
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
      mockFrom.mockReturnValue({ insert: mockInsert })

      const id = await FeedbackRepository.save({
        userId: 'u1',
        rating: 5,
        message: 'Ótimo sistema',
        planId: 'experimental',
        actionTaken: 'pending',
      })

      expect(id).toBe('fb-1')
      expect(mockInsert).toHaveBeenCalledWith({
        user_id: 'u1',
        rating: 5,
        message: 'Ótimo sistema',
        plan_id: 'experimental',
        action_taken: 'pending',
      })
    })

    it('lança erro quando insert falha', async () => {
      const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'insert error' } })
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
      mockFrom.mockReturnValue({ insert: mockInsert })

      await expect(FeedbackRepository.save({
        userId: 'u1', rating: 5, planId: 'experimental', actionTaken: 'pending',
      })).rejects.toThrow('FeedbackRepository.save failed: insert error')
    })
  })

  describe('hasAnyForUser', () => {
    it('retorna true quando existe feedback', async () => {
      const mockMaybeSingle = vi.fn().mockResolvedValue({ data: { id: 'fb-1' }, error: null })
      const mockLimit = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
      const mockEq = vi.fn().mockReturnValue({ limit: mockLimit })
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
      mockFrom.mockReturnValue({ select: mockSelect })

      expect(await FeedbackRepository.hasAnyForUser('u1')).toBe(true)
    })

    it('retorna false quando nao existe feedback', async () => {
      const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
      const mockLimit = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
      const mockEq = vi.fn().mockReturnValue({ limit: mockLimit })
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
      mockFrom.mockReturnValue({ select: mockSelect })

      expect(await FeedbackRepository.hasAnyForUser('u1')).toBe(false)
    })
  })

  describe('updateActionTaken', () => {
    it('atualiza action_taken do feedback', async () => {
      const mockEq = vi.fn().mockResolvedValue({ error: null })
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
      mockFrom.mockReturnValue({ update: mockUpdate })

      await FeedbackRepository.updateActionTaken('fb-1', 'upgrade_modal')
      expect(mockUpdate).toHaveBeenCalledWith({ action_taken: 'upgrade_modal' })
    })

    it('lança erro quando update falha', async () => {
      const mockEq = vi.fn().mockResolvedValue({ error: { message: 'update error' } })
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
      mockFrom.mockReturnValue({ update: mockUpdate })

      await expect(FeedbackRepository.updateActionTaken('fb-1', 'upgrade_modal'))
        .rejects.toThrow('FeedbackRepository.updateActionTaken failed: update error')
    })
  })
})
