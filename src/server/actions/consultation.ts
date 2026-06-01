'use server'

import { supabase } from '@/server/supabase'
import { getServerUser } from '@/server/services/session'
import { CreditRepository } from '@/server/repositories/credits'
import { resolveTerminalState } from '@/lib/consultation-state'
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

  // Iniciar um novo atendimento sinaliza que qualquer in_progress órfão sem IA
  // de outro paciente foi abandonado — devolve esses créditos reservados.
  await reconcileOrphanConsultations(patientId)

  return {}
}

export async function abandonConsultation(
  patientId: string,
  currentStep: ConsultationStep,
): Promise<void> {
  const user = await getServerUser()
  if (!user) return

  // Fonte de verdade = banco. Lê tudo o que decide o desfecho.
  const { data: existing } = await supabase
    .from('consultations')
    .select('debit_source, audio_attempts, structured_anamnesis')
    .eq('user_id', user.sub)
    .eq('patient_id', patientId)
    .single()

  const { status, refundSource } = resolveTerminalState({
    audio_attempts: existing?.audio_attempts as number | null | undefined,
    structured_anamnesis: existing?.structured_anamnesis,
    debit_source: (existing?.debit_source ?? null) as 'bonus' | 'paid' | null,
  })

  // raw_transcript sempre limpo (privacidade). created_at/updated_at NÃO são
  // tocados: no caminho 'completed' preserva a data real do atendimento; no
  // caminho 'abandoned' abandonar não é um "atendimento" datável.
  await supabase.from('consultations').upsert(
    {
      user_id: user.sub,
      patient_id: patientId,
      status,
      current_step: currentStep,
      raw_transcript: null,
    },
    { onConflict: 'user_id,patient_id' },
  )

  if (refundSource) {
    await CreditRepository.refundCredit(user.sub, refundSource)
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

export async function reconcileOrphanConsultations(exceptPatientId: string): Promise<void> {
  const user = await getServerUser()
  if (!user) return

  // Órfãos = in_progress SEM uso de IA (audio_attempts = 0): crédito reservado
  // mas nenhum trabalho feito. Exclui o paciente que está sendo iniciado agora.
  const { data: orphans } = await supabase
    .from('consultations')
    .select('patient_id, debit_source, audio_attempts, structured_anamnesis')
    .eq('user_id', user.sub)
    .eq('status', 'in_progress')
    .eq('audio_attempts', 0)
    .neq('patient_id', exceptPatientId)

  for (const row of (orphans ?? [])) {
    const { status, refundSource } = resolveTerminalState({
      audio_attempts: row.audio_attempts as number | null,
      structured_anamnesis: row.structured_anamnesis,
      debit_source: (row.debit_source ?? null) as 'bonus' | 'paid' | null,
    })
    await supabase.from('consultations').upsert(
      {
        user_id: user.sub,
        patient_id: row.patient_id as string,
        status,
        raw_transcript: null,
      },
      { onConflict: 'user_id,patient_id' },
    )
    if (refundSource) {
      await CreditRepository.refundCredit(user.sub, refundSource)
    }
  }
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
