import { supabase } from '@/server/supabase'

export type NotificationType = 'info' | 'feature' | 'warning' | 'credit_injected'

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string | null
  actionUrl: string | null
  actionLabel: string | null
  readAt: string | null
  createdAt: string
}

export interface CreateNotificationInput {
  userId: string
  type: NotificationType
  title: string
  body?: string
  actionUrl?: string
  actionLabel?: string
}

function toNotification(row: Record<string, unknown>): Notification {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    type: row.type as NotificationType,
    title: row.title as string,
    body: (row.body as string | null) ?? null,
    actionUrl: (row.action_url as string | null) ?? null,
    actionLabel: (row.action_label as string | null) ?? null,
    readAt: (row.read_at as string | null) ?? null,
    createdAt: row.created_at as string,
  }
}

export async function listForUser(userId: string): Promise<Notification[]> {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)
  return (data ?? []).map(toNotification)
}

export async function countUnread(userId: string): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null)
  return count ?? 0
}

export async function markAsRead(userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw new Error(`markAsRead failed: ${error.message}`)
}

export async function markAllAsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)
  if (error) throw new Error(`markAllAsRead failed: ${error.message}`)
}

export async function findLatestUnreadByType(userId: string, type: NotificationType): Promise<Notification | null> {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('type', type)
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ? toNotification(data as Record<string, unknown>) : null
}

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  const { error } = await supabase.from('notifications').insert({
    user_id: input.userId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    action_url: input.actionUrl ?? null,
    action_label: input.actionLabel ?? null,
  })
  if (error) throw new Error(`createNotification failed: ${error.message}`)
}
