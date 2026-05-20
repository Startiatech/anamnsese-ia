import { listUsers } from '@/server/repositories/users'
import { UsageRepository } from '@/server/repositories/usage'
import { fetchUsdToBrl } from '@/server/currency'
import type { UserRow } from './users-client'
import { UsersClient } from './users-client'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const [allUsers, costSummary, usdToBrl] = await Promise.all([
    listUsers(),
    UsageRepository.getAllUsersCostSummary(),
    fetchUsdToBrl(),
  ])
  const users: UserRow[] = allUsers
    .filter((u) => u.role === 'user')
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      specialty: u.specialty,
      phone: u.phone,
      createdAt: u.createdAt,
      blocked: u.blocked,
      credits: u.creditsRemaining ?? 0,
      groqCost: costSummary[u.id] ?? 0,
      status: u.blocked
        ? 'blocked'
        : u.passwordIsTemp || !u.onboardingCompleted
          ? 'onboarding'
          : 'active',
      hasPin:   !!u.pinHash,
      pinIsTemp: u.pinIsTemp,
    }))

  return <UsersClient initialUsers={users} usdToBrl={usdToBrl} />
}
