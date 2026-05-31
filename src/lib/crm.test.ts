import { describe, it, expect } from 'vitest'
import { formatCrm } from './crm'

describe('formatCrm', () => {
  it('formata tipo, número e UF como "CRM 11111/AM"', () => {
    expect(formatCrm('CRM', '11111', 'AM')).toBe('CRM 11111/AM')
  })

  it('sem UF, retorna apenas "CRM 11111"', () => {
    expect(formatCrm('CRM', '11111', '')).toBe('CRM 11111')
  })

  it('só o tipo, retorna "CRM"', () => {
    expect(formatCrm('CRM', '', '')).toBe('CRM')
  })

  it('tudo vazio/nulo, retorna string vazia', () => {
    expect(formatCrm('', null, undefined)).toBe('')
  })

  it('ignora espaços nas bordas', () => {
    expect(formatCrm(' CRM ', ' 11111 ', ' AM ')).toBe('CRM 11111/AM')
  })
})
