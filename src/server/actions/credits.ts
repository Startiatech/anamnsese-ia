'use server'

import { CreditRepository } from '@/server/repositories/credits'

export async function injectCredits(
  userId: string,
  amount: number
): Promise<{ ok: boolean; error?: string; newTotal?: number }> {
  if (amount < 1 || amount > 500) {
    return { ok: false, error: 'Quantidade deve ser entre 1 e 500.' }
  }

  const newTotal = await CreditRepository.addCredits(userId, amount)
  return { ok: true, newTotal }
}
