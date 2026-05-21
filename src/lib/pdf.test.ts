// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { generatePDFBlob } from './pdf'
import type { Patient, Consultation } from '@/types'
import type { ClinicData } from './clinic'

const patient = { name: 'Joao', cpf: '123', birthDate: '1990-01-01' } as Patient
const consultation = {
  updatedAt: '2026-05-21T10:00:00Z',
  structuredAnamnesis: { sections: [{ title: 'Queixa', content: 'Dor' }] },
} as Consultation

const clinic: ClinicData = {
  clinicName: 'Clinica X',
  clinicCnpj: '11222333000181',
  clinicAddress: 'Rua A, 100',
  clinicCep: '01000000',
  clinicPhone: '(11) 99999-9999',
  clinicEmail: 'c@x.com',
  clinicLogoUrl: '',
  clinicLogoPath: '',
  clinicRtIsSelf: true,
  clinicRtName: 'Dr Y',
  clinicRtRegistry: 'CRM/SP 1',
  clinicBusinessHours: 'Seg-Sex 8h-18h',
}

describe('generatePDFBlob com dados da clinica', () => {
  it('gera Blob sem erro quando clinic fornecido', async () => {
    const blob = await generatePDFBlob({
      patient, consultation,
      doctorName: 'Dr Y', doctorCRM: 'CRM/SP 1', doctorSpecialty: 'Clinica',
      clinic,
    })
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  it('gera Blob sem erro quando clinic ausente (fallback)', async () => {
    const blob = await generatePDFBlob({
      patient, consultation,
      doctorName: 'Dr Y', doctorCRM: 'CRM/SP 1', doctorSpecialty: 'Clinica',
    })
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })
})
