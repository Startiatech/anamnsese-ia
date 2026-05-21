import { describe, it, expect } from 'vitest'
import { clinicSchema } from './schemas'

const valid = {
  clinicName: 'Clinica Teste',
  clinicCnpj: '11222333000181',
  clinicAddress: 'Rua A, 100, Sao Paulo - SP',
  clinicCep: '01000000',
  clinicPhone: '(11) 99999-9999',
  clinicEmail: 'contato@clinica.com',
  clinicWebsite: '',
  clinicRtIsSelf: true,
  clinicRtName: '',
  clinicRtRegistry: '',
  clinicBusinessHours: '',
}

describe('clinicSchema', () => {
  it('aceita payload valido com RT self', () => {
    expect(clinicSchema.safeParse(valid).success).toBe(true)
  })

  it('rejeita CNPJ com digito invalido', () => {
    const r = clinicSchema.safeParse({ ...valid, clinicCnpj: '11222333000180' })
    expect(r.success).toBe(false)
  })

  it('aceita CNPJ com mascara e normaliza', () => {
    const r = clinicSchema.safeParse({ ...valid, clinicCnpj: '11.222.333/0001-81' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.clinicCnpj).toBe('11222333000181')
  })

  it('rejeita CEP fora do formato', () => {
    expect(clinicSchema.safeParse({ ...valid, clinicCep: '1234' }).success).toBe(false)
  })

  it('aceita CEP com hifen e normaliza', () => {
    const r = clinicSchema.safeParse({ ...valid, clinicCep: '01000-000' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.clinicCep).toBe('01000000')
  })

  it('rejeita telefone curto', () => {
    expect(clinicSchema.safeParse({ ...valid, clinicPhone: '123' }).success).toBe(false)
  })

  it('rejeita email invalido', () => {
    expect(clinicSchema.safeParse({ ...valid, clinicEmail: 'naoemail' }).success).toBe(false)
  })

  it('exige nome e registro do RT quando rt_is_self = false', () => {
    const r = clinicSchema.safeParse({ ...valid, clinicRtIsSelf: false })
    expect(r.success).toBe(false)
  })

  it('aceita rt_is_self = false com nome e registro preenchidos', () => {
    const r = clinicSchema.safeParse({
      ...valid, clinicRtIsSelf: false,
      clinicRtName: 'Dra. Maria', clinicRtRegistry: 'CRM/SP 123456',
    })
    expect(r.success).toBe(true)
  })

  it('normaliza website sem https', () => {
    const r = clinicSchema.safeParse({ ...valid, clinicWebsite: 'clinica.com.br' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.clinicWebsite).toBe('https://clinica.com.br')
  })

  it('aceita website vazio (opcional)', () => {
    expect(clinicSchema.safeParse({ ...valid, clinicWebsite: '' }).success).toBe(true)
  })
})
