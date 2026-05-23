import { listRequests } from '@/server/repositories/requests'
import { RequestsClient } from './requests-client'

export const dynamic = 'force-dynamic'

export default async function RequestsPage() {
  const requests = await listRequests()
  return <RequestsClient initialRequests={requests} />
}
