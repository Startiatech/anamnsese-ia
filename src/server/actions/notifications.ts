'use server'

import { getServerUser } from '@/server/services/session'
import {
  listForUser,
  countUnread,
  markAsRead,
  markAllAsRead,
  type Notification,
} from '@/server/repositories/notifications'

export async function listMyNotifications(): Promise<{
  ok: boolean
  error?: string
  items: Notification[]
  unreadCount: number
}> {
  const session = await getServerUser()
  if (!session) return { ok: false, error: 'Unauthorized', items: [], unreadCount: 0 }

  const [items, unreadCount] = await Promise.all([
    listForUser(session.sub),
    countUnread(session.sub),
  ])

  return { ok: true, items, unreadCount }
}

export async function markNotificationAsRead(id: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getServerUser()
  if (!session) return { ok: false, error: 'Unauthorized' }

  if (!id || id.length > 64) return { ok: false, error: 'ID inválido' }

  try {
    await markAsRead(session.sub, id)
    return { ok: true }
  } catch {
    return { ok: false, error: 'Erro ao marcar como lida' }
  }
}

export async function markAllNotificationsAsRead(): Promise<{ ok: boolean; error?: string }> {
  const session = await getServerUser()
  if (!session) return { ok: false, error: 'Unauthorized' }

  try {
    await markAllAsRead(session.sub)
    return { ok: true }
  } catch {
    return { ok: false, error: 'Erro ao marcar todas como lidas' }
  }
}

export async function acknowledgeNotification(id: string): Promise<{ error?: string }> {
  const user = await getServerUser()
  if (!user) return { error: 'Não autenticado' }
  try {
    await markAsRead(user.sub, id)
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao marcar como lido' }
  }
}
