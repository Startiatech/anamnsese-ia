import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerUser } from '@/server/services/session'
import { supabase } from '@/server/supabase'
import { findUserById } from '@/server/repositories/users'
import { PatientRepository } from '@/server/repositories/db'
import type { ClinicData } from '@/lib/clinic'
import { ExportButtons } from '@/components/export/export-buttons'
import { AnamnesisDocument } from '@/components/anamnesis/anamnesis-document'
import { ROUTES } from '@/lib/routes'
import { formatCrm } from '@/lib/crm'
import type { StructuredAnamnesis } from '@/types'

export const dynamic = 'force-dynamic'

export default async function ResultadoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getServerUser()
  if (!user) redirect(ROUTES.login)

  // Lê o profissional do banco (fresco), não do JWT — que guarda o nome de quando
  // o usuário logou e ficaria defasado após editar o perfil. Fallback no JWT.
  const fullUser = await findUserById(user.sub)
  const professional = {
    name: fullUser?.name ?? user.name ?? '',
    specialty: fullUser?.specialty ?? user.specialty ?? '',
    crm: formatCrm(
      fullUser?.crmType ?? user.crmType,
      fullUser?.crmNumber ?? user.crmNumber,
      fullUser?.crmUf ?? user.crmUf,
    ),
  }

  const clinic: ClinicData | undefined = fullUser?.clinicName
    ? {
        clinicName:           fullUser.clinicName,
        clinicCnpj:           fullUser.clinicCnpj ?? '',
        clinicAddress:        fullUser.clinicAddress ?? '',
        clinicAddressNumber:  fullUser.clinicAddressNumber,
        clinicCep:            fullUser.clinicCep ?? '',
        clinicPhone:          fullUser.clinicPhone ?? '',
        clinicEmail:          fullUser.clinicEmail ?? '',
        clinicWebsite:        fullUser.clinicWebsite,
        clinicLogoUrl:        fullUser.clinicLogoUrl,
        clinicLogoPath:       fullUser.clinicLogoPath ?? '',
        clinicRtIsSelf:       fullUser.clinicRtIsSelf,
        clinicRtName:         fullUser.clinicRtName,
        clinicRtRegistry:     fullUser.clinicRtRegistry,
        clinicBusinessHours:  fullUser.clinicBusinessHours,
      }
    : undefined

  const { data } = await supabase
    .from('consultations')
    .select('*')
    .eq('user_id', user.sub)
    .eq('id', id)
    .single()

  if (!data || !data.structured_anamnesis) notFound()

  const patient = await PatientRepository.findById(user.sub, data.patient_id as string)
  if (!patient) notFound()

  const structuredAnamnesis = data.structured_anamnesis as StructuredAnamnesis
  const updatedAt = data.updated_at as string

  const consultation = {
    id,
    patientId: patient.id,
    rawTranscript: '',
    structuredAnamnesis,
    createdAt: data.created_at as string,
    updatedAt,
  }

  return (
    <div className="space-y-6">
      {/* Barra de navegação e ações (não aparece no print) */}
      <div className="flex items-start justify-between gap-4 print:hidden">
        <Link href={ROUTES.historico} className="text-sm text-primary hover:underline">
          ← Histórico
        </Link>
        <ExportButtons
          patient={patient}
          consultation={consultation}
          professional={professional}
          clinic={clinic}
        />
      </div>

      {/* Documento WYSIWYG — mesmo visual do PDF */}
      <AnamnesisDocument
        patient={patient}
        professional={professional}
        clinic={clinic}
        structuredAnamnesis={structuredAnamnesis}
        updatedAt={updatedAt}
      />
    </div>
  )
}
