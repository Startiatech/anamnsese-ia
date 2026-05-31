import { describe, it, expect } from 'vitest'
import {
  formatCnpj,
  formatCep,
  formatBirthDate,
  formatSectionTitle,
  computeLogoBox,
  buildAnamnesisDocModel,
} from './anamnesis-document-model'
import type { Patient, StructuredAnamnesis } from '@/types'
import type { ClinicData } from '@/lib/clinic'

const patient: Patient = {
  id: 'p1',
  name: 'Paciente 01',
  cpf: '051.669.280-16',
  birthDate: '2000-02-02',
  phone: '(32) 99944-7711',
  createdAt: '2026-05-31T00:00:00.000Z',
}

const professional = { name: 'Profissional Teste', specialty: 'Neuro', crm: 'CRM 11111/AM' }

const structuredAnamnesis: StructuredAnamnesis = {
  sections: [
    { title: 'Subjetivo (S)', content: 'Não informado.' },
    { title: 'Plano (P)', content: 'Não informado.' },
  ],
}

const clinic: ClinicData = {
  clinicName: 'Mente Livre',
  clinicCnpj: '05883090000120',
  clinicAddress: 'Travessa Madiã, Manaus - AM',
  clinicAddressNumber: '500',
  clinicCep: '69015368',
  clinicPhone: '(55) 55555-5555',
  clinicEmail: 'contato@mentelivre.com',
  clinicWebsite: 'https://mentelivre.com',
  clinicLogoUrl: 'https://x/logo.png',
  clinicLogoPath: '',
  clinicRtIsSelf: true,
}

describe('formatadores', () => {
  it('formatCnpj formata 14 dígitos', () => {
    expect(formatCnpj('05883090000120')).toBe('05.883.090/0001-20')
  })
  it('formatCnpj devolve o valor cru quando inválido', () => {
    expect(formatCnpj('123')).toBe('123')
  })
  it('formatCep formata 8 dígitos', () => {
    expect(formatCep('69015368')).toBe('69015-368')
  })
  it('formatBirthDate converte ISO para dd/mm/yyyy', () => {
    expect(formatBirthDate('2000-02-02')).toBe('02/02/2000')
  })
  it('formatSectionTitle move a letra para o início', () => {
    expect(formatSectionTitle('Subjetivo (S)')).toBe('(S) Subjetivo')
  })
  it('formatSectionTitle mantém título sem parênteses', () => {
    expect(formatSectionTitle('Evolução')).toBe('Evolução')
  })
})

describe('computeLogoBox', () => {
  it('preserva a proporção a partir da altura-alvo', () => {
    expect(computeLogoBox(200, 100, 22)).toEqual({ width: 44, height: 22 })
  })
  it('cai para quadrado quando as dimensões são inválidas', () => {
    expect(computeLogoBox(0, 0, 22)).toEqual({ width: 22, height: 22 })
  })
})

describe('buildAnamnesisDocModel', () => {
  it('monta a clínica com endereço e contato compostos', () => {
    const m = buildAnamnesisDocModel({ patient, professional, clinic, structuredAnamnesis, updatedAt: '2026-05-31T00:00:00.000Z' })
    expect(m.clinic).not.toBeNull()
    expect(m.clinic!.name).toBe('Mente Livre')
    expect(m.clinic!.addressLine).toBe('Travessa Madiã, Manaus - AM, 500 · CEP 69015-368')
    expect(m.clinic!.contactLine).toContain('CNPJ 05.883.090/0001-20')
    expect(m.clinic!.contactLine).toContain('contato@mentelivre.com')
    expect(m.clinic!.website).toBe('https://mentelivre.com')
    expect(m.clinic!.logoUrl).toBe('https://x/logo.png')
  })

  it('clinic é null quando não há nome da clínica', () => {
    const m = buildAnamnesisDocModel({ patient, professional, structuredAnamnesis, updatedAt: '2026-05-31T00:00:00.000Z' })
    expect(m.clinic).toBeNull()
  })

  it('inclui apenas linhas de paciente com valor', () => {
    const m = buildAnamnesisDocModel({
      patient: { ...patient, phone: undefined, birthDate: undefined },
      professional, structuredAnamnesis, updatedAt: '2026-05-31T00:00:00.000Z',
    })
    const labels = m.patientLines.map((l) => l.label)
    expect(labels).toEqual(['Nome', 'CPF'])
  })

  it('formata os títulos das seções com a letra no início', () => {
    const m = buildAnamnesisDocModel({ patient, professional, structuredAnamnesis, updatedAt: '2026-05-31T00:00:00.000Z' })
    expect(m.sections.map((s) => s.title)).toEqual(['(S) Subjetivo', '(P) Plano'])
  })

  it('monta o rodapé do profissional com nome — especialidade e CRM', () => {
    const m = buildAnamnesisDocModel({ patient, professional, structuredAnamnesis, updatedAt: '2026-05-31T00:00:00.000Z' })
    expect(m.professionalFooter).toEqual({ nameLine: 'Profissional Teste — Neuro', crm: 'CRM 11111/AM' })
  })

  it('rodapé é null quando não há nome do profissional', () => {
    const m = buildAnamnesisDocModel({
      patient, professional: { name: '', specialty: '', crm: '' }, structuredAnamnesis, updatedAt: '2026-05-31T00:00:00.000Z',
    })
    expect(m.professionalFooter).toBeNull()
  })
})
