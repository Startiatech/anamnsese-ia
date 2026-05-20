import { NextResponse } from 'next/server'
import { getServerUser } from '@/server/services/session'
import { supabase } from '@/server/supabase'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getServerUser()
  if (!user || (user.role !== 'admin' && user.role !== 'master')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { count } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('plan_id', id)

  return NextResponse.json({ userCount: count ?? 0 })
}
