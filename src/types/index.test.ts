import { describe, it, expect } from 'vitest'
import type { Patient, Consultation, Section, ConsultationStep } from './index'

describe('types', () => {
  it('Patient has required fields', () => {
    const patient: Patient = {
      id: '123',
      name: 'João Silva',
      cpf: '123.456.789-00',
      createdAt: new Date().toISOString(),
    }
    expect(patient.id).toBeDefined()
    expect(patient.name).toBeDefined()
    expect(patient.cpf).toBeDefined()
  })

  it('Consultation has patient_id and structured anamnesis', () => {
    const section: Section = { title: 'Subjetivo', content: 'Paciente relata...' }
    const consultation: Consultation = {
      id: '456',
      patientId: '123',
      rawTranscript: 'texto bruto',
      structuredAnamnesis: { sections: [section] },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    expect(consultation.structuredAnamnesis.sections).toHaveLength(1)
  })

  it('ConsultationStep covers all 5 steps', () => {
    const steps: ConsultationStep[] = [1, 2, 3, 4, 5]
    expect(steps).toHaveLength(5)
  })
})
