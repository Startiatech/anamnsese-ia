export interface Patient {
  id: string
  name: string
  cpf: string
  birthDate?: string      // ISO date string: "YYYY-MM-DD"
  phone?: string
  externalId?: string
  createdAt: string       // ISO datetime string
}

export interface PatientWithStats extends Patient {
  consultationCount: number
  lastConsultationAt?: string  // ISO datetime of most recent consultation
}

export interface Section {
  title: string
  content: string
}

export interface StructuredAnamnesis {
  sections: Section[]
}

export interface Consultation {
  id: string
  patientId: string
  rawTranscript: string
  structuredAnamnesis: StructuredAnamnesis
  createdAt: string
  updatedAt: string
}

export type ConsultationStep = 1 | 2 | 3 | 4 | 5

export interface ConsultationFlowState {
  step: ConsultationStep
  patient: Patient | null
  rawTranscript: string
  selectedSections: string[]
  structuredAnamnesis: StructuredAnamnesis | null
}

// Default SOAP section titles offered to the professional
export const DEFAULT_SOAP_SECTIONS = [
  'Subjetivo (S)',
  'Objetivo (O)',
  'Avaliação (A)',
  'Plano (P)',
] as const

export interface PlanFeatures {
  audioAttemptsLabel: string
  refinementsLabel: string
}

export interface Professional {
  name: string
  specialty: string
  crm: string
}

// ─── User ────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  name: string
  email: string
  role: 'user' | 'admin' | 'master'
  specialty?: string
  credits: number
  /** Derived from name — first letters of first and last word */
  initials: string
}
