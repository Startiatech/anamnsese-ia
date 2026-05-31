import { describe, it, expect } from 'vitest'
import { formatCPF, validateCPFFormat, formatDate, formatDateTime, generateId, formatPhone, capitalizeName } from './utils'

describe('capitalizeName', () => {
  it('capitaliza cada palavra mantendo conectores em minúsculo', () => {
    expect(capitalizeName('joão da silva')).toBe('João da Silva')
  })
  it('capitaliza nome simples de clínica', () => {
    expect(capitalizeName('mente livre')).toBe('Mente Livre')
  })
  it('normaliza texto todo em maiúsculo', () => {
    expect(capitalizeName('CLÍNICA DOS ANJOS')).toBe('Clínica dos Anjos')
  })
  it('capitaliza o conector quando é a primeira palavra', () => {
    expect(capitalizeName('da vinci')).toBe('Da Vinci')
  })
  it('normaliza espaços extras', () => {
    expect(capitalizeName('  joão   silva  ')).toBe('João Silva')
  })
  it('lida com string vazia', () => {
    expect(capitalizeName('')).toBe('')
  })
})

describe('formatCPF', () => {
  it('formats raw CPF digits', () => {
    expect(formatCPF('12345678900')).toBe('123.456.789-00')
  })
  it('returns already formatted CPF unchanged', () => {
    expect(formatCPF('123.456.789-00')).toBe('123.456.789-00')
  })
})

describe('validateCPFFormat', () => {
  it('accepts formatted CPF', () => {
    expect(validateCPFFormat('123.456.789-00')).toBe(true)
  })
  it('rejects incomplete CPF', () => {
    expect(validateCPFFormat('123.456')).toBe(false)
  })
  it('rejects empty string', () => {
    expect(validateCPFFormat('')).toBe(false)
  })
})

describe('formatDate', () => {
  it('formats ISO date to DD/MM/YYYY', () => {
    expect(formatDate('2024-03-15')).toBe('15/03/2024')
  })
  it('formats ISO datetime to DD/MM/YYYY', () => {
    expect(formatDate('2024-03-15T10:30:00.000Z')).toBe('15/03/2024')
  })
})

describe('formatDateTime', () => {
  it('formats ISO datetime to DD/MM/YYYY às HH:MM in UTC', () => {
    expect(formatDateTime('2024-03-15T10:30:00.000Z')).toBe('15/03/2024 às 10:30')
  })
  it('pads hours and minutes with zeros', () => {
    expect(formatDateTime('2024-01-05T09:05:00.000Z')).toBe('05/01/2024 às 09:05')
  })
})

describe('formatPhone', () => {
  it('formats 10-digit landline', () => {
    expect(formatPhone('3299447711')).toBe('(32) 9944-7711')
  })
  it('formats 11-digit mobile', () => {
    expect(formatPhone('32999447711')).toBe('(32) 99944-7711')
  })
  it('strips non-digits before formatting', () => {
    expect(formatPhone('(32) 99944-7711')).toBe('(32) 99944-7711')
  })
  it('handles partial input gracefully without breaking', () => {
    expect(() => formatPhone('32')).not.toThrow()
    expect(formatPhone('32')).toBe('32')
  })
  it('truncates to 11 digits', () => {
    expect(formatPhone('329994477119999')).toBe('(32) 99944-7711')
  })
})

describe('generateId', () => {
  it('generates a non-empty string', () => {
    expect(generateId().length).toBeGreaterThan(0)
  })
  it('generates unique ids', () => {
    expect(generateId()).not.toBe(generateId())
  })
})
