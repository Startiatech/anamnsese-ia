'use client'
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import type { ConsultationFlowState, Patient, StructuredAnamnesis, ConsultationStep, PlanFeatures, Professional } from '@/types'
import type { ClinicData } from '@/lib/clinic'

interface ConsultationContextValue {
  state: ConsultationFlowState
  setPatient: (patient: Patient) => void
  setRawTranscript: (transcript: string) => void
  setSelectedSections: (sections: string[]) => void
  setStructuredAnamnesis: (anamnesis: StructuredAnamnesis) => void
  nextStep: () => void
  prevStep: () => void
  reset: () => void
  planFeatures: PlanFeatures
  professional: Professional
  clinic?: ClinicData
  audioAttemptsLimit: number | null
  refinementAttemptsLimit: number | null
  lastConsultationAt: string | null
  isTranscribing: boolean
  setIsTranscribing: (v: boolean) => void
}

const ConsultationContext = createContext<ConsultationContextValue | null>(null)

export function ConsultationProvider({
  children,
  initialPatient,
  initialTranscript,
  planFeatures,
  professional,
  clinic,
  audioAttemptsLimit,
  refinementAttemptsLimit,
  lastConsultationAt,
}: {
  children: ReactNode
  initialPatient?: Patient | null
  initialTranscript?: string
  planFeatures: PlanFeatures
  professional: Professional
  clinic?: ClinicData
  audioAttemptsLimit: number | null
  refinementAttemptsLimit: number | null
  lastConsultationAt: string | null
}) {
  const [state, setState] = useState<ConsultationFlowState>({
    step: 1,
    patient: initialPatient ?? null,
    rawTranscript: initialTranscript ?? '',
    selectedSections: [],
    structuredAnamnesis: null,
  })
  const [isTranscribing, setIsTranscribing] = useState(false)

  const setPatient = useCallback((patient: Patient) =>
    setState(s => ({ ...s, patient })), [])

  const setRawTranscript = useCallback((rawTranscript: string) =>
    setState(s => ({ ...s, rawTranscript })), [])

  const setSelectedSections = useCallback((selectedSections: string[]) =>
    setState(s => ({ ...s, selectedSections })), [])

  const setStructuredAnamnesis = useCallback((structuredAnamnesis: StructuredAnamnesis) =>
    setState(s => ({ ...s, structuredAnamnesis })), [])

  const nextStep = useCallback(() =>
    setState(s => ({ ...s, step: Math.min(5, s.step + 1) as ConsultationStep })), [])

  const prevStep = useCallback(() =>
    setState(s => ({ ...s, step: Math.max(1, s.step - 1) as ConsultationStep })), [])

  const reset = useCallback(() => setState({
    step: 1,
    patient: null,
    rawTranscript: '',
    selectedSections: [],
    structuredAnamnesis: null,
  }), [])

  return (
    <ConsultationContext.Provider value={{
      state, setPatient, setRawTranscript, setSelectedSections,
      setStructuredAnamnesis, nextStep, prevStep, reset,
      planFeatures, professional, clinic, audioAttemptsLimit, refinementAttemptsLimit, lastConsultationAt,
      isTranscribing, setIsTranscribing,
    }}>
      {children}
    </ConsultationContext.Provider>
  )
}

export function useConsultationFlow(): ConsultationContextValue {
  const ctx = useContext(ConsultationContext)
  if (!ctx) throw new Error('useConsultationFlow must be used within ConsultationProvider')
  return ctx
}
