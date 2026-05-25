import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSupabase = vi.hoisted(() => ({
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
}))

vi.mock('@/server/supabase', () => ({ supabase: mockSupabase }))

import { updateAccessibilityPrefs, findUserById } from './users'

describe('updateAccessibilityPrefs', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('mapeia camelCase -> snake_case com fontSize e highContrast', async () => {
    mockSupabase.update.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })

    await updateAccessibilityPrefs('u1', { fontSize: 'large', highContrast: true })

    expect(mockSupabase.from).toHaveBeenCalledWith('users')
    expect(mockSupabase.update).toHaveBeenCalledWith({
      pref_font_size: 'large',
      pref_high_contrast: true,
    })
  })

  it('aceita atualizacao parcial — apenas fontSize', async () => {
    mockSupabase.update.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })

    await updateAccessibilityPrefs('u1', { fontSize: 'xlarge' })

    expect(mockSupabase.update).toHaveBeenCalledWith({ pref_font_size: 'xlarge' })
  })

  it('aceita atualizacao parcial — apenas highContrast', async () => {
    mockSupabase.update.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })

    await updateAccessibilityPrefs('u1', { highContrast: false })

    expect(mockSupabase.update).toHaveBeenCalledWith({ pref_high_contrast: false })
  })

  it('lanca erro quando supabase retorna error', async () => {
    mockSupabase.update.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: { message: 'permission denied' } }),
    })

    await expect(
      updateAccessibilityPrefs('u1', { fontSize: 'large' })
    ).rejects.toThrow(/updateAccessibilityPrefs failed: permission denied/)
  })
})

describe('findUserById mapping — accessibility prefs', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('mapeia pref_font_size e pref_high_contrast com defaults', async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: {
        id: 'u1',
        name: 'Test',
        email: 't@e.com',
        password_hash: 'h',
        role: 'user',
        created_at: '2026-01-01',
        pref_font_size: 'large',
        pref_high_contrast: true,
      },
      error: null,
    })

    const user = await findUserById('u1')

    expect(user?.prefFontSize).toBe('large')
    expect(user?.prefHighContrast).toBe(true)
  })

  it('aplica defaults quando colunas vem null', async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: {
        id: 'u1',
        name: 'Test',
        email: 't@e.com',
        password_hash: 'h',
        role: 'user',
        created_at: '2026-01-01',
        pref_font_size: null,
        pref_high_contrast: null,
      },
      error: null,
    })

    const user = await findUserById('u1')

    expect(user?.prefFontSize).toBe('normal')
    expect(user?.prefHighContrast).toBe(false)
  })
})
