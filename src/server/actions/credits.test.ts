// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockAddBonusCredits } = vi.hoisted(() => ({
  mockAddBonusCredits: vi.fn(),
}))

vi.mock('@/server/repositories/credits', () => ({
  CreditRepository: {
    addBonusCredits: mockAddBonusCredits,
  },
}))

import { injectCredits } from './credits'

describe('injectCredits', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejeita amount = 0', async () => {
    const result = await injectCredits('u1', 0)
    expect(result).toEqual({ ok: false, error: 'Quantidade deve ser entre 1 e 500.' })
    expect(mockAddBonusCredits).not.toHaveBeenCalled()
  })

  it('rejeita amount negativo', async () => {
    const result = await injectCredits('u1', -5)
    expect(result).toEqual({ ok: false, error: 'Quantidade deve ser entre 1 e 500.' })
    expect(mockAddBonusCredits).not.toHaveBeenCalled()
  })

  it('rejeita amount > 500', async () => {
    const result = await injectCredits('u1', 501)
    expect(result).toEqual({ ok: false, error: 'Quantidade deve ser entre 1 e 500.' })
    expect(mockAddBonusCredits).not.toHaveBeenCalled()
  })

  it('chama addCredits atômico e retorna newTotal', async () => {
    mockAddBonusCredits.mockResolvedValue(30)
    const result = await injectCredits('u1', 20)
    expect(mockAddBonusCredits).toHaveBeenCalledWith('u1', 20)
    expect(result).toEqual({ ok: true, newTotal: 30 })
  })

  it('funciona com amount = 500 (limite máximo)', async () => {
    mockAddBonusCredits.mockResolvedValue(500)
    const result = await injectCredits('u1', 500)
    expect(mockAddBonusCredits).toHaveBeenCalledWith('u1', 500)
    expect(result).toEqual({ ok: true, newTotal: 500 })
  })
})
