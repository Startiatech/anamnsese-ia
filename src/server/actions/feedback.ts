// src/server/actions/feedback.ts
'use server'

import { supabase } from '@/server/supabase'
import { getServerUser } from '@/server/services/session'
import { FeedbackRepository } from '@/server/repositories/feedbacks'

export async function saveFeedback(input: {
  rating: number
  message?: string
}): Promise<{ feedbackId?: string; error?: string }> {
  const user = await getServerUser()
  if (!user) return { error: 'Unauthorized' }

  const feedbackId = await FeedbackRepository.save({
    userId: user.sub,
    rating: input.rating,
    message: input.message ?? '',
    planId: (user as { planId?: string }).planId ?? 'experimental',
    actionTaken: 'pending',
  })

  return { feedbackId }
}

export async function scheduleAccountDeletion(
  feedbackId: string
): Promise<{ ok?: boolean; error?: string }> {
  const user = await getServerUser()
  if (!user) return { error: 'Unauthorized' }

  const deletionDate = new Date()
  deletionDate.setDate(deletionDate.getDate() + 7)

  await supabase
    .from('users')
    .update({ deletion_scheduled_at: deletionDate.toISOString() })
    .eq('id', user.sub)

  await FeedbackRepository.updateActionTaken(feedbackId, 'declined')

  return { ok: true }
}

export async function cancelAccountDeletion(): Promise<{ ok?: boolean; error?: string }> {
  const user = await getServerUser()
  if (!user) return { error: 'Unauthorized' }

  await supabase
    .from('users')
    .update({ deletion_scheduled_at: null })
    .eq('id', user.sub)

  return { ok: true }
}

export async function markFeedbackUpgrade(
  feedbackId: string,
  source: 'upgrade_modal' | 'upgrade_organic'
): Promise<void> {
  if (!feedbackId) return
  await FeedbackRepository.updateActionTaken(feedbackId, source)
}
