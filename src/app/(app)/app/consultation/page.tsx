import { redirect } from 'next/navigation'
import { getServerUser } from '@/server/services/session'
import { PatientRepository } from '@/server/repositories/db'
import { findUserById } from '@/server/repositories/users'
import { isClinicComplete } from '@/lib/clinic'
import { ROUTES } from '@/lib/routes'
import { ConsultationPageClient } from '@/components/consultation/consultation-page-client'

export const dynamic = 'force-dynamic'

export default async function AtendimentoPage() {
  const user = await getServerUser()
  if (!user) redirect(ROUTES.login)

  const [patients, storedUser] = await Promise.all([
    PatientRepository.findAllWithStats(user.sub),
    findUserById(user.sub),
  ])

  const clinicComplete = storedUser ? isClinicComplete(storedUser) : false

  return <ConsultationPageClient initialPatients={patients} clinicComplete={clinicComplete} />
}
