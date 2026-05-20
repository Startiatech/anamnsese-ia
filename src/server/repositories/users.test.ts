// src/server/repositories/users.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSelect, mockUpdate, mockSingle, mockEq, mockLte, mockNot, mockSelectCount } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockSingle: vi.fn(),
  mockEq: vi.fn(),
  mockLte: vi.fn(),
  mockNot: vi.fn(),
  mockSelectCount: vi.fn(),
}))

vi.mock('@/server/supabase', () => {
  const chain: Record<string, unknown> = {}
  chain.select = (...args: unknown[]) => {
    const opts = args[1] as Record<string, unknown> | undefined
    if (opts?.head) { mockSelect(...args); return mockSelectCount() }
    mockSelect(...args)
    return chain
  }
  chain.update = (...args: unknown[]) => { mockUpdate(...args); return chain }
  chain.eq = (...args: unknown[]) => { mockEq(...args); return chain }
  chain.not = (...args: unknown[]) => { mockNot(...args); return chain }
  chain.lte = (...args: unknown[]) => mockLte(...args)
  chain.single = mockSingle
  return { supabase: { from: vi.fn(() => chain) } }
})

import { findUserById, findUsersScheduledForDeletion, countRegisteredUsers } from './users'

describe('findUserById — novos campos', () => {
  beforeEach(() => vi.clearAllMocks())

  it('mapeia deletion_scheduled_at e bonus_credits corretamente', async () => {
    mockSingle.mockResolvedValue({
      data: {
        id: 'u1', name: 'Dr. Ana', email: 'ana@clinic.com',
        password_hash: 'hash', role: 'user',
        plan_id: 'experimental', plan_selected: false,
        onboarding_completed: true, password_is_temp: false,
        blocked: false, credits_remaining: 0,
        created_at: '2026-01-01T00:00:00Z',
        deletion_scheduled_at: '2026-04-17T02:00:00Z',
        bonus_credits: 3,
      },
      error: null,
    })

    const user = await findUserById('u1')
    expect(user?.deletionScheduledAt).toBe('2026-04-17T02:00:00Z')
    expect(user?.bonusCredits).toBe(3)
  })

  it('retorna lista de usuários com deletion_scheduled_at vencido', async () => {
    const pastDate = new Date(Date.now() - 1000).toISOString()
    const rows = [
      {
        id: 'u3', name: 'Dr. X', email: 'x@clinic.com',
        password_hash: 'hash', role: 'user',
        plan_id: 'experimental', plan_selected: false,
        onboarding_completed: true, password_is_temp: false,
        blocked: false, credits_remaining: 0,
        created_at: '2026-01-01T00:00:00Z',
        deletion_scheduled_at: pastDate,
        bonus_credits: 0,
        minutes_per_consultation: 45,
      },
    ]
    mockLte.mockResolvedValue({ data: rows, error: null })

    const result = await findUsersScheduledForDeletion()
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('u3')
    expect(mockSelect).toHaveBeenCalledWith('*')
    expect(mockNot).toHaveBeenCalledWith('deletion_scheduled_at', 'is', null)
  })

  it('retorna lista vazia quando não há usuários a purgar', async () => {
    mockLte.mockResolvedValue({ data: [], error: null })
    const result = await findUsersScheduledForDeletion()
    expect(result).toHaveLength(0)
  })

  it('retorna deletionScheduledAt null quando não agendado', async () => {
    mockSingle.mockResolvedValue({
      data: {
        id: 'u2', name: 'Dr. Pedro', email: 'pedro@clinic.com',
        password_hash: 'hash', role: 'user',
        plan_id: 'experimental', plan_selected: false,
        onboarding_completed: true, password_is_temp: false,
        blocked: false, credits_remaining: 5,
        created_at: '2026-01-01T00:00:00Z',
        deletion_scheduled_at: null,
        bonus_credits: 0,
      },
      error: null,
    })

    const user = await findUserById('u2')
    expect(user?.deletionScheduledAt).toBeNull()
    expect(user?.bonusCredits).toBe(0)
  })
})

describe('countRegisteredUsers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna contagem de todos os usuários sem filtro de role', async () => {
    mockSelectCount.mockResolvedValue({ count: 7, error: null })

    const result = await countRegisteredUsers()

    expect(result).toBe(7)
    expect(mockSelect).toHaveBeenCalledWith('*', { count: 'exact', head: true })
  })

  it('retorna 0 quando count é null', async () => {
    mockSelectCount.mockResolvedValue({ count: null, error: null })

    const result = await countRegisteredUsers()

    expect(result).toBe(0)
  })
})
