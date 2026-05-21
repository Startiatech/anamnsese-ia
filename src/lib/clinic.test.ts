import { describe, it, expect } from 'vitest'
import { isValidCnpj, isClinicComplete } from './clinic'
import type { StoredUser } from '@/server/repositories/users'

describe('isValidCnpj', () => {
  it('aceita CNPJ valido sem mascara', () => {
    expect(isValidCnpj('11222333000181')).toBe(true)
  })
  it('rejeita CNPJ com digito verificador invalido', () => {
    expect(isValidCnpj('11222333000180')).toBe(false)
  })
  it('rejeita CNPJ com tamanho errado', () => {
    expect(isValidCnpj('123')).toBe(false)
  })
  it('rejeita CNPJ com todos digitos iguais', () => {
    expect(isValidCnpj('11111111111111')).toBe(false)
  })
})

function baseUser(overrides: Partial<StoredUser> = {}): StoredUser {
  return {
    id: 'u1', name: 'Doc', email: 'd@x.com', passwordHash: 'h', role: 'user',
    planId: 'experimental', planSelected: false, onboardingCompleted: false,
    passwordIsTemp: false, blocked: false, createdAt: '2026-01-01',
    deletionScheduledAt: null, bonusCredits: 0, minutesPerConsultation: 45,
    pinIsTemp: false,
    clinicName: 'Clinica X', clinicCnpj: '11222333000181',
    clinicAddress: 'Rua 1', clinicCep: '01000000',
    clinicPhone: '11999999999', clinicEmail: 'c@x.com',
    clinicLogoUrl: 'https://x/y.png', clinicLogoPath: 'u1/123.png',
    clinicRtIsSelf: true,
    ...overrides,
  } as StoredUser
}

describe('isClinicComplete', () => {
  it('true quando todos obrigatorios preenchidos e RT = self', () => {
    expect(isClinicComplete(baseUser())).toBe(true)
  })
  it('false quando logo ausente', () => {
    expect(isClinicComplete(baseUser({ clinicLogoUrl: undefined }))).toBe(false)
  })
  it('false quando RT nao e self e nome do RT ausente', () => {
    expect(isClinicComplete(baseUser({ clinicRtIsSelf: false, clinicRtRegistry: 'CRM/SP 1' }))).toBe(false)
  })
  it('true quando RT nao e self e nome + registro preenchidos', () => {
    expect(isClinicComplete(baseUser({
      clinicRtIsSelf: false, clinicRtName: 'Dr Y', clinicRtRegistry: 'CRM/SP 1',
    }))).toBe(true)
  })
})
