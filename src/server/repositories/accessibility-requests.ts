import { supabase } from '@/server/supabase'

export type AccessibilityRequestStatus = 'pending' | 'read' | 'archived'

export interface AccessibilityRequest {
  id: string
  userId: string
  message: string
  status: AccessibilityRequestStatus
  createdAt: string
  updatedAt: string
}

export interface AccessibilityRequestWithUser extends AccessibilityRequest {
  userName: string | null
  userEmail: string | null
}

interface RowWithUser {
  id: string
  user_id: string
  message: string
  status: AccessibilityRequestStatus
  created_at: string
  updated_at: string
  users: { name: string; email: string } | null
}

function toRequestWithUser(row: RowWithUser): AccessibilityRequestWithUser {
  return {
    id: row.id,
    userId: row.user_id,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    userName: row.users?.name ?? null,
    userEmail: row.users?.email ?? null,
  }
}

export async function createAccessibilityRequest(userId: string, message: string): Promise<string> {
  const { data, error } = await supabase
    .from('accessibility_requests')
    .insert({ user_id: userId, message })
    .select('id')
    .single()
  if (error) throw new Error(`createAccessibilityRequest failed: ${error.message}`)
  return (data as { id: string }).id
}

export async function listAllForAdmin(): Promise<AccessibilityRequestWithUser[]> {
  const { data } = await supabase
    .from('accessibility_requests')
    .select('id, user_id, message, status, created_at, updated_at, users(name, email)')
    .order('created_at', { ascending: false })
  return (data as RowWithUser[] | null ?? []).map(toRequestWithUser)
}

export async function countPending(): Promise<number> {
  const { count } = await supabase
    .from('accessibility_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
  return count ?? 0
}

export async function updateRequestStatus(id: string, status: AccessibilityRequestStatus): Promise<void> {
  const { error } = await supabase
    .from('accessibility_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(`updateRequestStatus failed: ${error.message}`)
}
