'use server'

import { getServerUser } from '@/server/services/session'
import {
  createAccessibilityRequest,
  listAllForAdmin,
  countPending,
  updateRequestStatus,
  type AccessibilityRequestWithUser,
} from '@/server/repositories/accessibility-requests'
import { accessibilityRequestSchema } from '@/lib/schemas'

export async function submitAccessibilityRequest(
  input: { message: string }
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const session = await getServerUser()
  if (!session) return { ok: false, error: 'Unauthorized' }

  const parsed = accessibilityRequestSchema.safeParse(input)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Dados inválidos'
    return { ok: false, error: message }
  }

  try {
    const id = await createAccessibilityRequest(session.sub, parsed.data.message)
    return { ok: true, id }
  } catch {
    return { ok: false, error: 'Erro ao enviar pedido' }
  }
}

export async function listAccessibilityRequests(): Promise<{
  ok: boolean
  error?: string
  items: AccessibilityRequestWithUser[]
  pendingCount: number
}> {
  const session = await getServerUser()
  if (!session) return { ok: false, error: 'Unauthorized', items: [], pendingCount: 0 }
  if (session.role !== 'admin' && session.role !== 'master') {
    return { ok: false, error: 'Forbidden', items: [], pendingCount: 0 }
  }

  const [items, pendingCount] = await Promise.all([listAllForAdmin(), countPending()])
  return { ok: true, items, pendingCount }
}

export async function markRequestAsRead(id: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getServerUser()
  if (!session) return { ok: false, error: 'Unauthorized' }
  if (session.role !== 'admin' && session.role !== 'master') return { ok: false, error: 'Forbidden' }

  try {
    await updateRequestStatus(id, 'read')
    return { ok: true }
  } catch {
    return { ok: false, error: 'Erro ao atualizar pedido' }
  }
}

export async function archiveRequest(id: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getServerUser()
  if (!session) return { ok: false, error: 'Unauthorized' }
  if (session.role !== 'admin' && session.role !== 'master') return { ok: false, error: 'Forbidden' }

  try {
    await updateRequestStatus(id, 'archived')
    return { ok: true }
  } catch {
    return { ok: false, error: 'Erro ao arquivar pedido' }
  }
}
