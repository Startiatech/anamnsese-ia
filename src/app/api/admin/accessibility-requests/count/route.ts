import { NextResponse } from 'next/server'
import { getServerUser } from '@/server/services/session'
import { countPending } from '@/server/repositories/accessibility-requests'

export async function GET() {
  const session = await getServerUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin' && session.role !== 'master') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const count = await countPending()
  return NextResponse.json({ count })
}
