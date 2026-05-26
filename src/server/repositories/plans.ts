import { supabase } from '@/server/supabase'

export interface PlanFeature {
  id: string
  label: string
  active: boolean
  limit?: number | null  // null = ilimitado, number = máximo de tentativas
}

export interface Plan {
  id: string
  name: string
  description: string
  price: number
  quota: number
  active: boolean
  features: PlanFeature[]
  sort_order: number
}

export const PlanRepository = {
  async listActive(): Promise<Plan[]> {
    const { data } = await supabase
      .from('plans')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true })

    return (data ?? []) as Plan[]
  },

  async getUserPlan(userId: string): Promise<{ planId: string; planSelected: boolean }> {
    const { data } = await supabase
      .from('users')
      .select('plan_id, plan_selected')
      .eq('id', userId)
      .single()

    return {
      planId: (data?.plan_id as string | null) ?? 'experimental',
      planSelected: (data?.plan_selected as boolean | null) ?? false,
    }
  },

  async getQuotaByPlanId(planId: string): Promise<number> {
    const { data } = await supabase
      .from('plans')
      .select('quota')
      .eq('id', planId)
      .single()
    return (data?.quota as number | null) ?? 0
  },

  async selectPlan(userId: string, planId: string): Promise<void> {
    const { data: plan } = await supabase
      .from('plans')
      .select('quota')
      .eq('id', planId)
      .single()
    const quota = (plan?.quota as number | null) ?? 0

    await supabase
      .from('users')
      .update({ plan_id: planId, plan_selected: true, credits_remaining: quota })
      .eq('id', userId)
  },
}
