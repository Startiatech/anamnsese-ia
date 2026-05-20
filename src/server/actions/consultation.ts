'use server'

import { supabase } from '@/server/supabase'
import { getServerUser } from '@/server/services/session'
import type { ConsultationStep } from '@/types'

export async function debitConsultationCredit(patientId: string): Promise<{ error?: string }> {
  const user = await getServerUser()
  if (!user) return { error: 'Não autenticado' }

  const { data: userData } = await supabase
    .from('users')
    .select('credits_remaining')
    .eq('id', user.sub)
    .single()

  if (!userData || (userData.credits_remaining as number) < 1) {
    return { error: 'Créditos insuficientes' }
  }

  await supabase.rpc('debit_user_credit', { p_user_id: user.sub })

  const now = new Date().toISOString()
  await supabase.from('consultations').upsert(
    {
      user_id: user.sub,
      patient_id: patientId,
      status: 'in_progress',
      current_step: 2,
      audio_attempts: 0,
      refinement_attempts: 0,
      raw_transcript: null,
      created_at: now,
      updated_at: now,
    },
    { onConflict: 'user_id,patient_id' },
  )

  return {}
}

export async function abandonConsultation(
  patientId: string,
  currentStep: ConsultationStep,
  aiWasUsed: boolean,
): Promise<void> {
  const user = await getServerUser()
  if (!user) return

  // raw_transcript is always cleared for privacy on abandonment
  await supabase.from('consultations').upsert(
    {
      user_id: user.sub,
      patient_id: patientId,
      status: 'abandoned',
      current_step: currentStep,
      raw_transcript: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,patient_id' },
  )

  if (!aiWasUsed) {
    await supabase.rpc('refund_user_credit', { p_user_id: user.sub })
  }
}

export async function saveTranscriptAndIncrementAttempts(
  patientId: string,
  transcript: string,
): Promise<void> {
  const user = await getServerUser()
  if (!user) return
  await supabase.rpc('save_transcript_and_increment', {
    p_user_id: user.sub,
    p_patient_id: patientId,
    p_transcript: transcript,
  })
}

export async function completeConsultation(patientId: string): Promise<void> {
  const user = await getServerUser()
  if (!user) return
  await supabase
    .from('consultations')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('user_id', user.sub)
    .eq('patient_id', patientId)
}

export async function saveRecordingConsent(patientId: string, consentText: string): Promise<void> {
  const user = await getServerUser()
  if (!user) return
  await supabase
    .from('consultations')
    .update({ recording_consent_text: consentText, updated_at: new Date().toISOString() })
    .eq('user_id', user.sub)
    .eq('patient_id', patientId)
}

export async function clearTranscript(patientId: string): Promise<void> {
  const user = await getServerUser()
  if (!user) return
  await supabase
    .from('consultations')
    .update({ raw_transcript: null, updated_at: new Date().toISOString() })
    .eq('user_id', user.sub)
    .eq('patient_id', patientId)
}

export async function getLatestConsultation(
  patientId: string,
  userId: string,
): Promise<{
  id: string
  structuredAnamnesis: { sections: { title: string; content: string }[] }
  rawTranscript: string
  createdAt: string
  updatedAt: string
} | null> {
  const { data, error } = await supabase
    .from('consultations')
    .select('id, structured_anamnesis, raw_transcript, created_at, updated_at')
    .eq('patient_id', patientId)
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return null

  return {
    id: data.id,
    structuredAnamnesis: data.structured_anamnesis,
    rawTranscript: data.raw_transcript,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}
