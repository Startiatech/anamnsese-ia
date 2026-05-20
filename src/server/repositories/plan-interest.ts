import { supabase } from '@/server/supabase'
import type { PlanInterestPlan } from '@/lib/schemas'

export interface PlanInterest {
  id: string
  name: string
  email: string
  plan: PlanInterestPlan
  created_at: string
}

export const PlanInterestRepository = {
  async save(data: { name: string; email: string; plan: PlanInterestPlan }): Promise<{ error?: string }> {
    const { error } = await supabase
      .from('plan_interest')
      .upsert(
        { name: data.name, email: data.email, plan: data.plan, created_at: new Date().toISOString() },
        { onConflict: 'email,plan' }
      )

    if (error) return { error: error.message }
    return {}
  },

  async list(): Promise<PlanInterest[]> {
    const { data, error } = await supabase
      .from('plan_interest')
      .select('id, name, email, plan, created_at')
      .order('created_at', { ascending: false })

    if (error) return []
    return (data ?? []) as PlanInterest[]
  },
}
