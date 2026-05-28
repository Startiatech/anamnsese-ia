import { listRequests } from '@/lib/requests'
import { getServerUser } from '@/server/services/session'
import { CreditRepository } from '@/server/repositories/credits'
import { PlanInterestRepository } from '@/server/repositories/plan-interest'
import { findUserById } from '@/server/repositories/users'
import { listForUser as listNotifications, countUnread } from '@/server/repositories/notifications'
import { countPending as countA11yPending } from '@/server/repositories/accessibility-requests'
import { deriveInitials } from '@/lib/utils'
import { AdminLayoutClient } from './admin-layout-client'
import type { User } from '@/types'
import type { Notification } from '@/server/repositories/notifications'

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
  let initialSpacingIncreased = false
  let initialFocusHighlight = false
  let initialExtraReducedMotion = false
  let initialNotifications: Notification[] = []
  let initialNotificationsUnread = 0
  let initialA11yPendingCount = 0

  if (payload) {
    const [credits, storedUser, notifications, unread, a11yPending] = await Promise.all([
      CreditRepository.getCredits(payload.sub),
      findUserById(payload.sub),
      listNotifications(payload.sub),
      countUnread(payload.sub),
      countA11yPending(),
    ])
    initialCredits = credits
    initialFontSize = storedUser?.prefFontSize ?? 'normal'
    initialHighContrast = storedUser?.prefHighContrast ?? false
    initialSpacingIncreased = storedUser?.prefSpacingIncreased ?? false
    initialFocusHighlight = storedUser?.prefFocusHighlight ?? false
    initialExtraReducedMotion = storedUser?.prefExtraReducedMotion ?? false
    initialNotifications = notifications
    initialNotificationsUnread = unread
    initialA11yPendingCount = a11yPending
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
      initialSpacingIncreased={initialSpacingIncreased}
      initialFocusHighlight={initialFocusHighlight}
      initialExtraReducedMotion={initialExtraReducedMotion}
      initialNotifications={initialNotifications}
      initialNotificationsUnread={initialNotificationsUnread}
      initialA11yPendingCount={initialA11yPendingCount}
    >
      {children}
    </AdminLayoutClient>
  )
}
