import { redirect } from 'next/navigation'
import { getServerUser } from '@/server/services/session'
import { FeedbackRepository } from '@/server/repositories/feedbacks'
import { ROUTES } from '@/lib/routes'
import { FeedbacksClient } from './feedbacks-client'

export default async function FeedbacksPage() {
  const user = await getServerUser()
  if (!user || (user.role !== 'admin' && user.role !== 'master')) {
    redirect(ROUTES.login)
  }

  const [metrics, feedbacks] = await Promise.all([
    FeedbackRepository.getMetrics(),
    FeedbackRepository.listAll({ page: 0, pageSize: 20 }),
  ])

  return (
    <FeedbacksClient
      metrics={metrics}
      feedbacks={feedbacks}
    />
  )
}
