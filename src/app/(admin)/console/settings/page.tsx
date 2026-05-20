import { redirect } from 'next/navigation'
import { getServerUser } from '@/server/services/session'
import { ROUTES } from '@/lib/routes'
import { SettingsClient } from './settings-client'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const sessionUser = await getServerUser()
  if (!sessionUser) redirect(ROUTES.login)
  if (sessionUser.role !== 'master') redirect(ROUTES.console)

  return (
    <SettingsClient
      userName={sessionUser.name}
    />
  )
}
