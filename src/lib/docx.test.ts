// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { generateDOCXBlob } from './docx'
import type { Patient, Consultation } from '@/types'
import type { ClinicData } from '@/lib/clinic'

const patient: Patient = {
  id: 'p1',
  name: 'João Silva',
  cpf: '123.456.789-09',
  birthDate: '1990-05-15',
  phone: '(11) 91234-5678',
  createdAt: new Date().toISOString(),
}

const consultation: Consultation = {
  id: 'c1',
  patientId: 'p1',
  rawTranscript: '',
  structuredAnamnesis: {
    sections: [
      { title: 'Queixa Principal', content: 'Dor de cabeça.' },
    ],
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const clinic: ClinicData = {
  clinicName: 'Clínica Exemplo',
  clinicCnpj: '00000000000191',
  clinicAddress: 'Rua das Flores, 100',
  clinicCep: '01310100',
  clinicPhone: '(11) 3000-0000',
  clinicEmail: 'contato@clinica.com',
  clinicLogoUrl: '',
  clinicLogoPath: '',
  clinicWebsite: 'https://clinica.com',
  clinicRtIsSelf: true,
  clinicBusinessHours: 'Seg-Sex 8h-18h',
}

describe('generateDOCXBlob', () => {
  it('gera Blob com dados da clínica (com clinic)', async () => {
    const blob = await generateDOCXBlob({
      patient,
      consultation,
      doctorName: 'Dr. Teste',
      doctorCRM: '12345/SP',
      doctorSpecialty: 'Clínica Geral',
      clinic,
    })
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
    expect(blob.size).toBeGreaterThan(0)
  })

  it('gera Blob sem dados da clínica (fallback)', async () => {
    const blob = await generateDOCXBlob({
      patient,
      consultation,
      doctorName: 'Dr. Teste',
      doctorCRM: '12345/SP',
      doctorSpecialty: 'Clínica Geral',
    })
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
    expect(blob.size).toBeGreaterThan(0)
  })
})
