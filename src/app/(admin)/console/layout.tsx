import { listRequests } from '@/lib/requests'
import { getServerUser } from '@/server/services/session'
import { CreditRepository } from '@/server/repositories/credits'
import { PlanInterestRepository } from '@/server/repositories/plan-interest'
import { findUserById } from '@/server/repositories/users'
import { deriveInitials } from '@/lib/utils'
import { AdminLayoutClient } from './admin-layout-client'
import type { User } from '@/types'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [payload, initialRequests, interests] = await Promise.all([
    getServerUser(),
    listRequests(),
    PlanInterestRepository.list(),
  ])

  let initialUser: User | null = null
  let initialCredits = 0
  let initialFontSize: 'normal' | 'large' | 'xlarge' = 'normal'
  let initialHighContrast = false

  if (payload) {
    const [credits, storedUser] = await Promise.all([
      CreditRepository.getCredits(payload.sub),
      findUserById(payload.sub),
    ])
    initialCredits = credits
    initialFontSize = storedUser?.prefFontSize ?? 'normal'
    initialHighContrast = storedUser?.prefHighContrast ?? false
    initialUser = {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      credits: initialCredits,
      initials: deriveInitials(payload.name),
    }
  }

  return (
    <AdminLayoutClient
      initialUser={initialUser}
      initialCredits={initialCredits}
      initialRequests={initialRequests}
      interestCount={interests.length}
      initialFontSize={initialFontSize}
      initialHighContrast={initialHighContrast}
    >
      {children}
    </AdminLayoutClient>
  )
}
