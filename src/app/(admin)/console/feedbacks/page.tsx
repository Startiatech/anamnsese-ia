import { redirect } from 'next/navigation'
import { getServerUser } from '@/server/services/session'
import { FeedbackRepository } from '@/server/repositories/feedbacks'
import { listAllForAdmin as listA11yRequests, countPending as countA11yPending } from '@/server/repositories/accessibility-requests'
import { ROUTES } from '@/lib/routes'
import { FeedbacksClient } from './feedbacks-client'

export default async function FeedbacksPage() {
  const user = await getServerUser()
  if (!user || (user.role !== 'admin' && user.role !== 'master')) {
    redirect(ROUTES.login)
  }

  const [metrics, feedbacks, a11yRequests, a11yPending] = await Promise.all([
    FeedbackRepository.getMetrics(),
    FeedbackRepository.listAll({ page: 0, pageSize: 20 }),
    listA11yRequests(),
    countA11yPending(),
  ])

  return (
    <FeedbacksClient
      metrics={metrics}
      feedbacks={feedbacks}
      a11yRequests={a11yRequests}
      a11yPendingCount={a11yPending}
    />
  )
}
