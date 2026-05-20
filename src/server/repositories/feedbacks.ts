// src/server/repositories/feedbacks.ts
import { supabase } from '@/server/supabase'

export type FeedbackActionTaken =
  | 'pending'
  | 'upgrade_modal'
  | 'upgrade_organic'
  | 'declined'

export interface FeedbackInput {
  userId: string
  rating: number
  message?: string
  planId: string
  actionTaken: FeedbackActionTaken
}

export interface Feedback extends FeedbackInput {
  id: string
  sentimentScore?: number | null
  sentimentLabel?: string | null
  analyzedAt?: string | null
  createdAt: string
}

export interface FeedbackWithUser {
  id: string
  userId: string
  userName: string
  userEmail: string
  userPhone?: string | null
  rating: number
  message?: string | null
  planId: string
  actionTaken: FeedbackActionTaken
  sentimentScore?: number | null
  sentimentLabel?: string | null
  analyzedAt?: string | null
  createdAt: string
}

export interface FeedbackMetrics {
  avgRating: number
  totalUpgrades: number
  totalChurn: number
  conversionRate: number
}

export const FeedbackRepository = {
  async save(input: FeedbackInput): Promise<string> {
    const { data, error } = await supabase
      .from('feedbacks')
      .insert({
        user_id: input.userId,
        rating: input.rating,
        message: input.message ?? null,
        plan_id: input.planId,
        action_taken: input.actionTaken,
      })
      .select('id')
      .single()
    if (error) throw new Error(`FeedbackRepository.save failed: ${error.message}`)
    return (data as { id: string }).id
  },

  async hasAnyForUser(userId: string): Promise<boolean> {
    const { data } = await supabase
      .from('feedbacks')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()
    return data !== null
  },

  async updateActionTaken(id: string, actionTaken: FeedbackActionTaken): Promise<void> {
    const { error } = await supabase
      .from('feedbacks')
      .update({ action_taken: actionTaken })
      .eq('id', id)
    if (error) throw new Error(`FeedbackRepository.updateActionTaken failed: ${error.message}`)
  },

  async listAll({ page, pageSize }: { page: number; pageSize: number }): Promise<FeedbackWithUser[]> {
    const from = page * pageSize
    const to = from + pageSize - 1
    const { data } = await supabase
      .from('feedbacks')
      .select('*, users(name, email, phone)')
      .order('created_at', { ascending: false })
      .range(from, to)
    return ((data ?? []) as Array<Record<string, unknown>>).map(row => ({
      id: row.id as string,
      userId: row.user_id as string,
      userName: ((row.users as Record<string, unknown>)?.name as string) ?? '',
      userEmail: ((row.users as Record<string, unknown>)?.email as string) ?? '',
      userPhone: ((row.users as Record<string, unknown>)?.phone as string | null) ?? null,
      rating: row.rating as number,
      message: row.message as string | null,
      planId: row.plan_id as string,
      actionTaken: row.action_taken as FeedbackActionTaken,
      sentimentScore: row.sentiment_score as number | null,
      sentimentLabel: row.sentiment_label as string | null,
      analyzedAt: row.analyzed_at as string | null,
      createdAt: row.created_at as string,
    }))
  },

  async getMetrics(): Promise<FeedbackMetrics> {
    const { data } = await supabase
      .from('feedbacks')
      .select('rating, action_taken')
    const rows = (data ?? []) as Array<{ rating: number; action_taken: string }>
    const total = rows.length
    if (total === 0) return { avgRating: 0, totalUpgrades: 0, totalChurn: 0, conversionRate: 0 }
    const decided = rows.filter(r => r.action_taken !== 'pending')
    const avgRating = decided.length > 0
      ? decided.reduce((acc, r) => acc + r.rating, 0) / decided.length
      : 0
    const totalUpgrades = rows.filter(r => r.action_taken === 'upgrade_modal' || r.action_taken === 'upgrade_organic').length
    const totalChurn = rows.filter(r => r.action_taken === 'declined').length
    const conversionRate = (totalUpgrades / total) * 100
    return { avgRating, totalUpgrades, totalChurn, conversionRate }
  },
}
