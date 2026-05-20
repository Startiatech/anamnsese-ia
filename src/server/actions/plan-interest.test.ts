// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSave = vi.hoisted(() => vi.fn())

vi.mock('@/server/repositories/plan-interest', () => ({
  PlanInterestRepository: { save: mockSave },
}))

import { savePlanInterestAction } from './plan-interest'

describe('savePlanInterestAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('chama repository com dados válidos e retorna {}', async () => {
    mockSave.mockResolvedValue({})

    const result = await savePlanInterestAction({
      name: 'João Silva',
      email: 'joao@email.com',
      plan: 'profissional',
    })

    expect(mockSave).toHaveBeenCalledWith({
      name: 'João Silva',
      email: 'joao@email.com',
      plan: 'profissional',
    })
    expect(result).toEqual({})
  })

  it('retorna { error } sem chamar repository quando email é inválido', async () => {
    const result = await savePlanInterestAction({
      name: 'João Silva',
      email: 'nao-e-email',
      plan: 'profissional',
    })

    expect(mockSave).not.toHaveBeenCalled()
    expect(result).toHaveProperty('error')
  })

  it('retorna { error } sem chamar repository quando nome é muito curto', async () => {
    const result = await savePlanInterestAction({
      name: 'A',
      email: 'joao@email.com',
      plan: 'profissional',
    })

    expect(mockSave).not.toHaveBeenCalled()
    expect(result).toHaveProperty('error')
  })

  it('retorna { error } sem chamar repository quando plan é inválido', async () => {
    const result = await savePlanInterestAction({
      name: 'João Silva',
      email: 'joao@email.com',
      plan: 'enterprise',
    })

    expect(mockSave).not.toHaveBeenCalled()
    expect(result).toHaveProperty('error')
  })

  it('retorna { error } sem chamar repository quando data é null', async () => {
    const result = await savePlanInterestAction(null)

    expect(mockSave).not.toHaveBeenCalled()
    expect(result).toHaveProperty('error')
  })

  it('propaga erro do repository', async () => {
    mockSave.mockResolvedValue({ error: 'Erro de banco' })

    const result = await savePlanInterestAction({
      name: 'João Silva',
      email: 'joao@email.com',
      plan: 'gestao-clinicas',
    })

    expect(result).toEqual({ error: 'Erro de banco' })
  })
})
