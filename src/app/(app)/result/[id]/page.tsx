import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerUser } from '@/server/services/session'
import { supabase } from '@/server/supabase'
import { findUserById } from '@/server/repositories/users'
import { PatientRepository } from '@/server/repositories/db'
import type { ClinicData } from '@/lib/clinic'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ExportButtons } from '@/components/export/export-buttons'
import { formatDate } from '@/lib/utils'
import { ROUTES } from '@/lib/routes'
import type { StructuredAnamnesis } from '@/types'

export const dynamic = 'force-dynamic'

export default async function ResultadoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getServerUser()
  if (!user) redirect(ROUTES.login)

  const fullUser = await findUserById(user.sub)
  const crmParts = [user.crmType, user.crmNumber, user.crmUf].filter(Boolean)
  const professional = {
    name: user.name ?? '',
    specialty: user.specialty ?? '',
    crm: crmParts.length ? crmParts.join(' ') : '',
  }

  const clinic: ClinicData | undefined = fullUser?.clinicName && fullUser.clinicLogoUrl
    ? {
        clinicName:           fullUser.clinicName,
        clinicCnpj:           fullUser.clinicCnpj ?? '',
        clinicAddress:        fullUser.clinicAddress ?? '',
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
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href={ROUTES.historico} className="text-sm text-primary hover:underline">← Histórico</Link>
          <h1 className="mt-1 text-2xl font-bold">Anamnese</h1>
          <p className="text-sm text-muted-foreground">
            {patient.name} — {formatDate(updatedAt)}
          </p>
        </div>
        <div className="shrink-0 mt-1">
          <ExportButtons patient={patient} consultation={consultation} professional={professional} clinic={clinic} />
        </div>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-1 text-sm">
          <p><span className="font-medium">Paciente:</span> {patient.name}</p>
          <p><span className="font-medium">CPF:</span> {patient.cpf}</p>
          {patient.birthDate && (
            <p><span className="font-medium">Nascimento:</span> {formatDate(patient.birthDate)}</p>
          )}
        </CardContent>
      </Card>

      <Separator />

      {structuredAnamnesis.sections.map(section => (
        <Card key={section.title}>
          <CardContent className="pt-4">
            <h2 className="mb-2 font-semibold text-primary">{section.title}</h2>
            <p className="text-sm whitespace-pre-wrap">{section.content}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
