// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }))

vi.mock('@/server/supabase', () => ({
  supabase: { from: mockFrom },
}))

import { SystemConfigRepository } from './system-config'

describe('SystemConfigRepository', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('get', () => {
    it('retorna valor quando chave existe', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { key: 'default_credits', value: '5' } }),
          }),
        }),
      })
      const result = await SystemConfigRepository.get('default_credits')
      expect(result).toBe('5')
    })

    it('retorna null quando chave não existe', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
      })
      const result = await SystemConfigRepository.get('chave_inexistente')
      expect(result).toBeNull()
    })
  })

  describe('set', () => {
    it('faz upsert do valor', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ error: null })
      mockFrom.mockReturnValue({ upsert: mockUpsert })

      await SystemConfigRepository.set('default_credits', '10')

      expect(mockUpsert).toHaveBeenCalledWith(
        { key: 'default_credits', value: '10' },
        { onConflict: 'key' }
      )
    })
  })
})
