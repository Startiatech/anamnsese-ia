import { supabase } from '@/lib/supabase'
import type { AccessRequest } from '@/lib/types'
import { ConsoleDashboardClient, type ProfessionalRow } from './console-dashboard-client'
import { getServerUser } from '@/lib/auth-server'
import { LoginToast } from '@/components/dashboard/login-toast'
import { UsageRepository } from '@/server/repositories/usage'
import { fetchUsdToBrl } from '@/server/currency'
import { listUsers } from '@/server/repositories/users'
import { PlanInterestRepository } from '@/server/repositories/plan-interest'

export const dynamic = 'force-dynamic'

function toAccessRequest(row: Record<string, unknown>): AccessRequest {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    phone: row.phone as string,
    specialty: row.specialty as string,
    message: row.message as string | undefined,
    status: row.status as AccessRequest['status'],
    createdAt: row.created_at as string,
  }
}

export default async function ConsolePage({
  searchParams,
}: {
  searchParams: Promise<{ login?: string }>
}) {
  const [{ data }, user, { login }, groqCostSummary, professionalsCount, activeUsersCount, usdToBrl, allUsers, interests] = await Promise.all([
    supabase.from('access_requests').select('*').order('created_at', { ascending: false }),
    getServerUser(),
    searchParams,
    UsageRepository.getCostSummary(),
    UsageRepository.getProfessionalsCount(),
    UsageRepository.getActiveUsersCount(),
    fetchUsdToBrl(),
    listUsers(),
    PlanInterestRepository.list(),
  ])

  const requests = (data ?? []).map(toAccessRequest)

  const professionals: ProfessionalRow[] = allUsers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    specialty: u.specialty ?? '',
    status: u.blocked
      ? 'blocked' as const
      : u.passwordIsTemp || !u.onboardingCompleted
        ? 'onboarding' as const
        : 'active' as const,
  }))

  return (
    <>
      <ConsoleDashboardClient initialRequests={requests} groqCostSummary={groqCostSummary} professionalsCount={professionalsCount} activeUsersCount={activeUsersCount} usdToBrl={usdToBrl} professionals={professionals} interestCount={interests.length} interestByPlan={{ profissional: interests.filter((i) => i.plan === 'profissional').length, 'gestao-clinicas': interests.filter((i) => i.plan === 'gestao-clinicas').length }} />
      {login === '1' && user && <LoginToast userName={user.name} />}
    </>
  )
}
