import { describe, it, expect } from 'vitest'
import { formatBRL } from './currency'

describe('formatBRL', () => {
  it('converte USD para BRL com 2 casas decimais', () => {
    expect(formatBRL(1, 5.75)).toBe('R$\xa05,75')
  })

  it('converte valor pequeno preservando até 4 casas decimais', () => {
    expect(formatBRL(0.0042, 5.75)).toBe('R$\xa00,0241')
  })

  it('retorna R$ 0,00 para valor zero', () => {
    expect(formatBRL(0, 5.75)).toBe('R$\xa00,00')
  })

  it('usa a taxa passada como parâmetro', () => {
    expect(formatBRL(1, 6)).toBe('R$\xa06,00')
    expect(formatBRL(1, 5)).toBe('R$\xa05,00')
  })
})
