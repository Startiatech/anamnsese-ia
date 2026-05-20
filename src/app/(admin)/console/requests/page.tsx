import { supabase } from '@/lib/supabase'
import type { AccessRequest } from '@/lib/types'
import { RequestsClient } from './requests-client'

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

export default async function RequestsPage() {
  const { data } = await supabase
    .from('access_requests')
    .select('*')
    .order('created_at', { ascending: false })

  const requests = (data ?? []).map(toAccessRequest)

  return <RequestsClient initialRequests={requests} />
}
