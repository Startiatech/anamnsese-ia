import { redirect } from 'next/navigation'
import { getServerUser } from '@/server/services/session'
import { findUserById } from '@/server/repositories/users'
import { isClinicComplete } from '@/lib/clinic'
import { ROUTES } from '@/lib/routes'
import { PageHeader } from '@/components/console/page-header'
import { SettingsClient } from './settings-client'

export const dynamic = 'force-dynamic'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const payload = await getServerUser()
  if (!payload) redirect(ROUTES.login)

  const user = await findUserById(payload.sub)
  if (!user) redirect(ROUTES.login)

  const params = await searchParams

  // Usuário já fez onboarding mas esqueceu a senha → fluxo de reset (vai direto para aba segurança)
  const isPasswordReset = !!user.passwordIsTemp && user.onboardingCompleted
  // Admin redefiniu o PIN → deve trocar senha E cadastrar novo PIN (via login com PIN temp)
  // OU usuário clicou em "Atualizar PIN" no banner (?pin=1) → fluxo guiado só de PIN
  const isPinReset = (isPasswordReset && user.pinIsTemp) || (params.pin === '1' && user.pinIsTemp)
  const isOnboarding = user.passwordIsTemp || !user.onboardingCompleted
  const profileCompleted = user.onboardingCompleted
  const clinicCompleted = isClinicComplete(user)
  const forceClinic = params.force === 'clinica'

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Gerencie seu perfil e preferências da conta." />
      <SettingsClient
        user={user}
        isOnboarding={isOnboarding}
        isPasswordReset={isPasswordReset || isPinReset}
        isPinReset={isPinReset}
        profileCompleted={profileCompleted}
        clinicCompleted={clinicCompleted}
        showIntro={isOnboarding && !isPasswordReset && !isPinReset}
        deletionScheduledAt={user.deletionScheduledAt}
        forceClinic={forceClinic}
      />
    </div>
  )
}
