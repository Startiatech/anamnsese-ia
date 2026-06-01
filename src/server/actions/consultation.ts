'use server'

import { supabase } from '@/server/supabase'
import { getServerUser } from '@/server/services/session'
import { CreditRepository } from '@/server/repositories/credits'
import type { ConsultationStep } from '@/types'

export async function debitConsultationCredit(patientId: string): Promise<{ error?: string }> {
  const user = await getServerUser()
  if (!user) return { error: 'Não autenticado' }

  const total = await CreditRepository.getCredits(user.sub)
  if (total < 1) {
    return { error: 'Créditos insuficientes' }
  }

  const source = await CreditRepository.debitCreditReturningSource(user.sub)
  if (!source) {
    return { error: 'Falha ao debitar crédito' }
  }

  // NÃO grava created_at: iniciar um atendimento não define a data do
  // atendimento. O usuário ainda pode abandonar (sem gerar anamnese). A data
  // real é carimbada só quando a anamnese é gerada (ConsultationRepository.save),
  // preservando a data do atendimento concluído anterior caso este seja abandonado.
  await supabase.from('consultations').upsert(
    {
      user_id: user.sub,
      patient_id: patientId,
      status: 'in_progress',
      current_step: 2,
      audio_attempts: 0,
      refinement_attempts: 0,
      raw_transcript: null,
      debit_source: source,
      updated_at: new Date().toISOString(),
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

  // Read debit_source before upsert to know which wallet to refund
  const { data: existing } = await supabase
    .from('consultations')
    .select('debit_source')
    .eq('user_id', user.sub)
    .eq('patient_id', patientId)
    .single()
  const source = (existing?.debit_source ?? null) as 'bonus' | 'paid' | null

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

  if (!aiWasUsed && source) {
    await CreditRepository.refundCredit(user.sub, source)
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
