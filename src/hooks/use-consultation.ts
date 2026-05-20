'use client'
import { useCallback } from 'react'
import { API } from '@/lib/routes'
import { clearTranscript } from '@/server/actions/consultation'
import type { Consultation, StructuredAnamnesis } from '@/types'

export function useConsultation(patientId: string) {
  const saveConsultation = useCallback(async (
    rawTranscript: string,
    structuredAnamnesis: StructuredAnamnesis,
  ): Promise<Consultation> => {
    const now = new Date().toISOString()
    const payload = {
      patientId,
      rawTranscript,
      structuredAnamnesis,
      createdAt: now,
      updatedAt: now,
    }
    const res = await fetch(API.consultations, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const { id } = await res.json() as { id: string }
    // Clear raw_transcript from DB for privacy after saving the structured anamnesis
    await clearTranscript(patientId)
    return { ...payload, id } as Consultation
  }, [patientId])

  return { saveConsultation }
}
