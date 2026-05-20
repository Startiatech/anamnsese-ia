import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ plans: data })
}

export async function PUT(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  const payload = token ? await verifyToken(token) : null

  if (!payload || (payload.role !== 'admin' && payload.role !== 'master')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { plans } = await req.json()

  if (!Array.isArray(plans)) {
    return NextResponse.json({ error: 'plans must be an array' }, { status: 400 })
  }

  for (const plan of plans) {
    const { error } = await supabase.from('plans').update({
      name: plan.name,
      description: plan.description,
      price: plan.price,
      quota: plan.quota,
      active: plan.active,
      features: plan.features,
      updated_at: new Date().toISOString(),
    }).eq('id', plan.id)

    if (error) {
      console.error('[plans PUT] upsert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
