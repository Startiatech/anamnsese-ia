'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabase } from '@/server/supabase'
import { getServerUser } from '@/server/services/session'
import { PlanRepository } from '@/server/repositories/plans'
import { ROUTES } from '@/lib/routes'
import { findUserById } from '@/server/repositories/users'
import { markFeedbackUpgrade } from '@/server/actions/feedback'

interface PlanFeature {
  id: string
  label: string
  active: boolean
}

interface Plan {
  id: string
  name: string
  description: string
  price: number
  quota: number
  active: boolean
  features: PlanFeature[]
}

export async function updatePlan(plan: Plan): Promise<{ error?: string }> {
  const user = await getServerUser()
  if (!user || (user.role !== 'admin' && user.role !== 'master')) {
    return { error: 'Forbidden' }
  }

  const { error } = await supabase.from('plans').update({
    name: plan.name,
    description: plan.description,
    price: plan.price,
    quota: plan.quota,
    active: plan.active,
    features: plan.features,
    updated_at: new Date().toISOString(),
  }).eq('id', plan.id)

  if (error) return { error: error.message }
  revalidatePath('/console/planos')
  return {}
}

export async function createPlan(plan: Omit<Plan, 'id'> & { sort_order?: number }): Promise<{ error?: string; id?: string }> {
  const user = await getServerUser()
  if (!user || (user.role !== 'admin' && user.role !== 'master')) {
    return { error: 'Forbidden' }
  }

  const id = plan.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const { data, error } = await supabase.from('plans').insert({
    id,
    name: plan.name,
    description: plan.description,
    price: plan.price,
    quota: plan.quota,
    active: plan.active,
    features: plan.features,
    sort_order: plan.sort_order ?? 99,
    updated_at: new Date().toISOString(),
  }).select('id').single()

  if (error) return { error: error.message }
  revalidatePath('/console/planos')
  return { id: (data as { id: string }).id }
}

export async function deletePlan(planId: string): Promise<{ error?: string }> {
  const user = await getServerUser()
  if (!user || (user.role !== 'admin' && user.role !== 'master')) {
    return { error: 'Forbidden' }
  }

  const { error } = await supabase.from('plans').delete().eq('id', planId)
  if (error) return { error: error.message }
  revalidatePath('/console/planos')
  return {}
}

export async function selectPlanAction(planId: string): Promise<void> {
  const user = await getServerUser()
  if (!user) redirect(ROUTES.login)

  // Herdar créditos do plano experimental como bônus
  const storedUser = await findUserById(user.sub)
  if (storedUser?.planId === 'experimental' && (storedUser.creditsRemaining ?? 0) > 0) {
    await supabase
      .from('users')
      .update({ bonus_credits: storedUser.creditsRemaining })
      .eq('id', user.sub)
    await markFeedbackUpgrade(undefined as unknown as string, 'upgrade_organic')
  }

  await PlanRepository.selectPlan(user.sub, planId)
  redirect(ROUTES.configuracoes)
}
