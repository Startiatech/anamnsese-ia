'use server'

import { CreditRepository } from '@/server/repositories/credits'
import { createNotification } from '@/server/repositories/notifications'

export async function injectCredits(
  userId: string,
  amount: number,
): Promise<{ ok: boolean; error?: string; newTotal?: number }> {
  if (amount < 1 || amount > 500) {
    return { ok: false, error: 'Quantidade deve ser entre 1 e 500.' }
  }

  const newTotal = await CreditRepository.addBonusCredits(userId, amount)
  await createNotification({
    userId,
    type: 'credit_injected',
    title: `🎁 Você recebeu ${amount} crédito${amount === 1 ? '' : 's'} bônus!`,
    body: 'Cortesia do time Anamnese IA. Disponível imediatamente para uso.',
  })
  return { ok: true, newTotal }
}
