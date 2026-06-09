import { supabase } from '@/server/supabase'
import type { AccessRequest } from '@/lib/types'

function toAccessRequest(row: Record<string, string>): AccessRequest {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    specialty: row.specialty,
    phone: row.phone,
    message: row.message,
    status: row.status as AccessRequest['status'],
    createdAt: row.created_at,
  }
}

export async function listRequests(): Promise<AccessRequest[]> {
  const { data } = await supabase.from('access_requests').select('*').order('created_at', { ascending: false })
  const requests = (data ?? []).map(toAccessRequest)

  // Enriquece status='approved' com password_is_temp do usuario correspondente.
  // Permite a UI mostrar "Ver credenciais" apenas enquanto o usuario ainda
  // nao trocou a senha temporaria.
  const approvedEmails = requests.filter((r) => r.status === 'approved').map((r) => r.email)
  if (approvedEmails.length === 0) return requests

  const { data: users } = await supabase
    .from('users')
    .select('email, password_is_temp')
    .in('email', approvedEmails)

  const tempMap = new Map<string, boolean>()
  for (const u of users ?? []) {
    tempMap.set(u.email as string, Boolean(u.password_is_temp))
  }

  return requests.map((r) =>
    r.status === 'approved'
      ? { ...r, userPasswordIsTemp: tempMap.get(r.email) ?? false }
      : r,
  )
}

export async function findRequestById(id: string): Promise<AccessRequest | undefined> {
  const { data } = await supabase
    .from('access_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  return data ? toAccessRequest(data as Record<string, string>) : undefined
}

export async function findRequestByEmail(email: string): Promise<AccessRequest | undefined> {
  const { data } = await supabase
    .from('access_requests')
    .select('*')
    .eq('email', email.toLowerCase())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ? toAccessRequest(data as Record<string, string>) : undefined
}

export async function addRequest(request: AccessRequest): Promise<void> {
  const { error } = await supabase.from('access_requests').insert({
    id: request.id,
    name: request.name,
    email: request.email,
    specialty: request.specialty,
    phone: request.phone,
    message: request.message ?? '',
    status: request.status,
  })
  if (error) throw new Error(`addRequest failed: ${error.message}`)
}

export async function updateRequestStatus(id: string, status: AccessRequest['status']): Promise<boolean> {
  const { error } = await supabase.from('access_requests').update({ status }).eq('id', id)
  return !error
}
