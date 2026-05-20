import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getServerUser } from '@/server/services/session'
import { CreditRepository } from '@/server/repositories/credits'
import { findUserById } from '@/server/repositories/users'
import { PlanRepository } from '@/server/repositories/plans'
import { deriveInitials } from '@/lib/utils'
import { ROUTES } from '@/lib/routes'
import { AppLayoutClient } from './app-layout-client'
import type { User } from '@/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const payload = await getServerUser()

  let initialUser: User | null = null
  let initialCredits = 0
  let initialPlanQuota = 0

  if (payload) {
    const isMasterOrAdmin = payload.role === 'master' || payload.role === 'admin'

    const [storedUser, credits] = await Promise.all([
      findUserById(payload.sub),
      isMasterOrAdmin ? Promise.resolve(0) : CreditRepository.getCredits(payload.sub),
    ])

    // JWT válido mas usuário deletado do banco → limpa cookie e redireciona
    if (!storedUser) {
      redirect('/api/auth/logout')
    }

    // Usuário bloqueado → tela de acesso suspenso
    if (storedUser.blocked) {
      redirect('/suspended')
    }

    initialCredits = credits
    initialPlanQuota = isMasterOrAdmin ? 0 : await PlanRepository.getQuotaByPlanId(storedUser.planId)
    initialUser = {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      specialty: storedUser?.specialty,
      credits: initialCredits,
      initials: deriveInitials(payload.name),
    }

    // Guard de onboarding — não se aplica a master/admin
    if (!isMasterOrAdmin) {
      const headersList = await headers()
      const isOnboardingRoute = headersList.get('x-is-onboarding') === '1'
      const isPlansRoute = headersList.get('x-is-plans') === '1'

      if (!isOnboardingRoute && (storedUser.passwordIsTemp || !storedUser.onboardingCompleted)) {
        redirect(ROUTES.configuracoes)
      }

      // Conta agendada para exclusão → força página de planos até escolher um
      if (!isPlansRoute && storedUser.deletionScheduledAt) {
        redirect(ROUTES.planos)
      }
    }

    const isOnboarding = !isMasterOrAdmin && !!(storedUser.passwordIsTemp || !storedUser.onboardingCompleted)

    return (
      <AppLayoutClient
        initialUser={initialUser}
        initialCredits={initialCredits}
        initialPlanQuota={initialPlanQuota}
        isOnboarding={isOnboarding}
        deletionScheduledAt={storedUser.deletionScheduledAt}
        bonusCredits={storedUser.bonusCredits}
        pinIsTemp={!isMasterOrAdmin && storedUser.pinIsTemp}
      >
        {children}
      </AppLayoutClient>
    )
  }

  return (
    <AppLayoutClient initialUser={initialUser} initialCredits={initialCredits} initialPlanQuota={0} isOnboarding={false} deletionScheduledAt={null} bonusCredits={0} pinIsTemp={false}>
      {children}
    </AppLayoutClient>
  )
}
