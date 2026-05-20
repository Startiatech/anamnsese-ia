import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/server/services/session'
import { updateUser, deleteUser, findUserById } from '@/server/repositories/users'
import { supabase } from '@/server/supabase'

async function requireAdmin() {
  const payload = await getServerUser()
  if (!payload || (payload.role !== 'admin' && payload.role !== 'master')) return null
  return payload
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await requireAdmin()
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const [{ count: patients }, { count: consultations }] = await Promise.all([
    supabase.from('patients').select('*', { count: 'exact', head: true }).eq('user_id', id),
    supabase.from('consultations').select('*', { count: 'exact', head: true }).eq('user_id', id),
  ])

  return NextResponse.json({ patients: patients ?? 0, consultations: consultations ?? 0 })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await requireAdmin()
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const user = await findUserById(id)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json()
  const allowed = ['name', 'specialty', 'phone', 'blocked'] as const
  const data: Partial<Pick<typeof user, 'name' | 'specialty' | 'phone' | 'blocked'>> = {}
  for (const key of allowed) {
    if (key in body) (data as Record<string, unknown>)[key] = body[key]
  }

  await updateUser(id, data)
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await requireAdmin()
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const user = await findUserById(id)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  await deleteUser(id)
  return NextResponse.json({ ok: true })
}
