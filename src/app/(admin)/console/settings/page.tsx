import { redirect } from 'next/navigation'
import { getServerUser } from '@/server/services/session'
import { findUserById } from '@/server/repositories/users'
import { ROUTES } from '@/lib/routes'
import { SettingsClient } from './settings-client'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const sessionUser = await getServerUser()
  if (!sessionUser) redirect(ROUTES.login)
  if (sessionUser.role !== 'master') redirect(ROUTES.console)

  const user = await findUserById(sessionUser.sub)
  if (!user) redirect(ROUTES.login)

  return (
    <SettingsClient
      userName={user.name}
      userEmail={user.email}
      userPhone={user.phone ?? ''}
    />
  )
}
