// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSupabase = vi.hoisted(() => ({
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
}))

vi.mock('@/server/supabase', () => ({ supabase: mockSupabase }))

import { PlanInterestRepository } from './plan-interest'

describe('PlanInterestRepository', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('save', () => {
    it('retorna {} quando upsert tem sucesso', async () => {
      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      })

      const result = await PlanInterestRepository.save({
        name: 'João Silva',
        email: 'joao@email.com',
        plan: 'profissional',
      })

      expect(result).toEqual({})
    })

    it('retorna { error } quando Supabase retorna erro', async () => {
      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: { message: 'duplicate key' } }),
      })

      const result = await PlanInterestRepository.save({
        name: 'João Silva',
        email: 'joao@email.com',
        plan: 'profissional',
      })

      expect(result).toEqual({ error: 'duplicate key' })
    })

    it('chama upsert com onConflict email,plan', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ error: null })
      mockSupabase.from.mockReturnValue({ upsert: mockUpsert })

      await PlanInterestRepository.save({ name: 'Ana', email: 'ana@email.com', plan: 'gestao-clinicas' })

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Ana', email: 'ana@email.com', plan: 'gestao-clinicas' }),
        { onConflict: 'email,plan' }
      )
    })
  })

  describe('list', () => {
    it('retorna lista de interesses ordenada', async () => {
      const rows = [
        { id: '1', name: 'Ana', email: 'ana@email.com', plan: 'profissional', created_at: '2026-05-08T10:00:00Z' },
        { id: '2', name: 'João', email: 'joao@email.com', plan: 'gestao-clinicas', created_at: '2026-05-08T09:00:00Z' },
      ]
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: rows, error: null }),
        }),
      })

      const result = await PlanInterestRepository.list()

      expect(result).toHaveLength(2)
      expect(result[0].email).toBe('ana@email.com')
    })

    it('retorna [] quando Supabase retorna erro', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: { message: 'connection error' } }),
        }),
      })

      const result = await PlanInterestRepository.list()

      expect(result).toEqual([])
    })

    it('retorna [] quando data é null sem erro', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      })

      const result = await PlanInterestRepository.list()

      expect(result).toEqual([])
    })
  })
})
