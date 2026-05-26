// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockAddBonusCredits, mockCreateNotification } = vi.hoisted(() => ({
  mockAddBonusCredits: vi.fn(),
  mockCreateNotification: vi.fn(),
}))

vi.mock('@/server/repositories/credits', () => ({
  CreditRepository: {
    addBonusCredits: mockAddBonusCredits,
  },
}))

vi.mock('@/server/repositories/notifications', () => ({
  createNotification: mockCreateNotification,
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

  it('chama addBonusCredits atomico e retorna newTotal', async () => {
    mockAddBonusCredits.mockResolvedValue(30)
    mockCreateNotification.mockResolvedValue(undefined)
    const result = await injectCredits('u1', 20)
    expect(mockAddBonusCredits).toHaveBeenCalledWith('u1', 20)
    expect(result).toEqual({ ok: true, newTotal: 30 })
  })

  it('funciona com amount = 500 (limite maximo)', async () => {
    mockAddBonusCredits.mockResolvedValue(500)
    mockCreateNotification.mockResolvedValue(undefined)
    const result = await injectCredits('u1', 500)
    expect(mockAddBonusCredits).toHaveBeenCalledWith('u1', 500)
    expect(result).toEqual({ ok: true, newTotal: 500 })
  })

  it('cria notification credit_injected ao injetar', async () => {
    mockAddBonusCredits.mockResolvedValue(10)
    mockCreateNotification.mockResolvedValue(undefined)
    await injectCredits('u1', 5)
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'credit_injected', userId: 'u1' }),
    )
  })

  it('nao cria notification quando amount invalido', async () => {
    await injectCredits('u1', 0)
    expect(mockCreateNotification).not.toHaveBeenCalled()
  })

  it('titulo usa singular para 1 credito', async () => {
    mockAddBonusCredits.mockResolvedValue(1)
    mockCreateNotification.mockResolvedValue(undefined)
    await injectCredits('u1', 1)
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('crédito b') }),
    )
    const call = mockCreateNotification.mock.calls[0][0] as { title: string }
    expect(call.title).not.toContain('créditos')
  })

  it('titulo usa plural para mais de 1 credito', async () => {
    mockAddBonusCredits.mockResolvedValue(5)
    mockCreateNotification.mockResolvedValue(undefined)
    await injectCredits('u1', 5)
    const call = mockCreateNotification.mock.calls[0][0] as { title: string }
    expect(call.title).toContain('créditos')
  })
})
