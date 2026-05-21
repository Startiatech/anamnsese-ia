import { redirect } from 'next/navigation'
import { getServerUser } from '@/server/services/session'
import { findUserById } from '@/server/repositories/users'
import { isClinicComplete } from '@/lib/clinic'
import { ROUTES } from '@/lib/routes'
import { NewPatientForm } from './new-patient-form'

export const dynamic = 'force-dynamic'

export default async function NovoPacientePage() {
  const payload = await getServerUser()
  if (!payload) redirect(ROUTES.login)

  const user = await findUserById(payload.sub)
  if (!user) redirect(ROUTES.login)

  if (!isClinicComplete(user)) {
    redirect(`${ROUTES.configuracoes}?force=clinica`)
  }

  return <NewPatientForm />
}
