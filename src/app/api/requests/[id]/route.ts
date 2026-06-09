import { NextResponse } from 'next/server'
import { getServerUser } from '@/server/services/session'
import { updateRequestStatus } from '@/lib/requests'

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const session = await getServerUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin' && session.role !== 'master') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const params = await props.params;
  const { status } = await req.json()

  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
  }

  const ok = await updateRequestStatus(params.id, status)
  if (!ok) return NextResponse.json({ error: 'Solicitação não encontrada' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
