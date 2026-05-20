'use server'

import { planInterestSchema } from '@/lib/schemas'
import { PlanInterestRepository } from '@/server/repositories/plan-interest'

export async function savePlanInterestAction(
  data: unknown
): Promise<{ error?: string }> {
  const parsed = planInterestSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  return PlanInterestRepository.save(parsed.data)
}
