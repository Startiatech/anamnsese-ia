import { supabase } from '@/lib/supabase'
import type { Plan } from './plans-client'
import { PlansClient } from './plans-client'

export const dynamic = 'force-dynamic'

export default async function PlansPage() {
  const { data } = await supabase
    .from('plans')
    .select('*')
    .order('sort_order', { ascending: true })

  const plans: Plan[] = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    quota: row.quota,
    active: row.active,
    features: row.features ?? [],
    sort_order: row.sort_order,
  }))

  return <PlansClient initialPlans={plans} />
}
