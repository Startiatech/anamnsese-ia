import { redirect } from 'next/navigation'
import { getServerUser } from '@/server/services/session'
import { PatientRepository } from '@/server/repositories/db'
import { ROUTES } from '@/lib/routes'
import { ConsultationPageClient } from '@/components/consultation/consultation-page-client'

export const dynamic = 'force-dynamic'

export default async function AtendimentoPage() {
  const user = await getServerUser()
  if (!user) redirect(ROUTES.login)

  const patients = await PatientRepository.findAllWithStats(user.sub)

  return <ConsultationPageClient initialPatients={patients} />
}
