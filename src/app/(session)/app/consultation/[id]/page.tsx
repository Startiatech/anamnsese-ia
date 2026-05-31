import { notFound, redirect } from 'next/navigation'
import { getServerUser } from '@/server/services/session'
import { PatientRepository } from '@/server/repositories/db'
import { findUserById } from '@/server/repositories/users'
import { supabase } from '@/server/supabase'
import { isClinicComplete, type ClinicData } from '@/lib/clinic'
import { ROUTES } from '@/lib/routes'
import { formatCrm } from '@/lib/crm'
import { ConsultationPageFlow } from './consultation-page-flow'

async function getConsultationPageData(
  userId: string,
  patientId: string,
  planId: string,
) {
  const [planResult, consultationResult] = await Promise.all([
    supabase.from('plans').select('features').eq('id', planId).single(),
    supabase
      .from('consultations')
      .select('audio_attempts, refinement_attempts, raw_transcript, status, updated_at')
      .eq('user_id', userId)
      .eq('patient_id', patientId)
      .single(),
  ])

  const features = (planResult.data?.features ?? []) as {
    id: string
    label: string
    active: boolean
    limit?: number | null
  }[]

  const f5 = features.find(f => f.id === 'f5')
  const f6 = features.find(f => f.id === 'f6')
  const consultation = consultationResult.data

  return {
    planFeatures: {
      audioAttemptsLabel: f5?.label ?? 'Envios de áudio incluídos',
      refinementsLabel: f6?.label ?? 'Refinamentos de IA incluídos',
    },
    audioAttemptsUsed: (consultation?.status === 'in_progress' ? (consultation?.audio_attempts ?? 0) : 0) as number,
    audioAttemptsLimit: f5?.limit ?? null,
    refinementAttemptsUsed: (consultation?.status === 'in_progress' ? (consultation?.refinement_attempts ?? 0) : 0) as number,
    refinementAttemptsLimit: f6?.limit ?? null,
    initialTranscript: (consultation?.status === 'in_progress' ? (consultation?.raw_transcript ?? '') : '') as string,
    lastConsultationAt: consultation?.status === 'completed' ? (consultation?.updated_at ?? null) : null,
  }
}

export default async function ConsultationSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getServerUser()
  if (!user) notFound()

  const planId = user.planId ?? 'experimental'

  const [patient, data, storedUser] = await Promise.all([
    PatientRepository.findById(user.sub, id),
    getConsultationPageData(user.sub, id, planId),
    findUserById(user.sub),
  ])

  if (!patient) notFound()

  if (!storedUser || !isClinicComplete(storedUser)) {
    redirect(`${ROUTES.configuracoes}?force=clinica`)
  }

  // Profissional sempre do banco (fresco), não do JWT — reflete edições de perfil.
  const professional = {
    name: storedUser.name ?? user.name ?? '',
    specialty: storedUser.specialty ?? user.specialty ?? '',
    crm: formatCrm(
      storedUser.crmType ?? user.crmType,
      storedUser.crmNumber ?? user.crmNumber,
      storedUser.crmUf ?? user.crmUf,
    ),
  }

  const clinic: ClinicData | undefined = storedUser.clinicName
    ? {
        clinicName:           storedUser.clinicName,
        clinicCnpj:           storedUser.clinicCnpj ?? '',
        clinicAddress:        storedUser.clinicAddress ?? '',
        clinicAddressNumber:  storedUser.clinicAddressNumber,
        clinicCep:            storedUser.clinicCep ?? '',
        clinicPhone:          storedUser.clinicPhone ?? '',
        clinicEmail:          storedUser.clinicEmail ?? '',
        clinicWebsite:        storedUser.clinicWebsite,
        clinicLogoUrl:        storedUser.clinicLogoUrl,
        clinicLogoPath:       storedUser.clinicLogoPath,
        clinicRtIsSelf:       storedUser.clinicRtIsSelf,
        clinicRtName:         storedUser.clinicRtName,
        clinicRtRegistry:     storedUser.clinicRtRegistry,
        clinicBusinessHours:  storedUser.clinicBusinessHours,
      }
    : undefined

  return (
    <ConsultationPageFlow
      patient={patient}
      planFeatures={data.planFeatures}
      audioAttemptsUsed={data.audioAttemptsUsed}
      audioAttemptsLimit={data.audioAttemptsLimit}
      refinementAttemptsUsed={data.refinementAttemptsUsed}
      refinementAttemptsLimit={data.refinementAttemptsLimit}
      initialTranscript={data.initialTranscript}
      lastConsultationAt={data.lastConsultationAt}
      professional={professional}
      clinic={clinic}
      creditsRemaining={storedUser?.creditsRemaining ?? 0}
      planId={storedUser?.planId ?? 'experimental'}
    />
  )
}
