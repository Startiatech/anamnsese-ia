import { supabase } from '@/server/supabase'

export type UserRole = 'user' | 'admin' | 'master'

export interface StoredUser {
  id: string
  name: string
  email: string
  passwordHash: string
  role: UserRole
  specialty?: string
  phone?: string
  crmType?: string
  crmNumber?: string
  crmUf?: string
  planId: string
  planSelected: boolean
  onboardingCompleted: boolean
  passwordIsTemp: boolean
  blocked: boolean
  createdAt: string
  creditsRemaining?: number
  deletionScheduledAt: string | null
  bonusCredits: number
  minutesPerConsultation: number
  pinHash?: string
  pinIsTemp: boolean
}

function toStoredUser(row: Record<string, unknown>): StoredUser {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    passwordHash: row.password_hash as string,
    role: row.role as UserRole,
    specialty: row.specialty as string | undefined,
    phone: row.phone as string | undefined,
    crmType: (row.crm_type as string | undefined) ?? 'CRM',
    crmNumber: row.crm_number as string | undefined,
    crmUf: row.crm_uf as string | undefined,
    planId: (row.plan_id as string | null) ?? 'experimental',
    planSelected: (row.plan_selected as boolean) ?? false,
    onboardingCompleted: (row.onboarding_completed as boolean) ?? false,
    passwordIsTemp: (row.password_is_temp as boolean) ?? false,
    blocked: (row.blocked as boolean) ?? false,
    createdAt: row.created_at as string,
    creditsRemaining: row.credits_remaining as number | undefined,
    deletionScheduledAt: (row.deletion_scheduled_at as string | null) ?? null,
    bonusCredits: (row.bonus_credits as number) ?? 0,
    minutesPerConsultation: (row.minutes_per_consultation as number) ?? 45,
    pinHash: (row.pin_hash as string | null) ?? undefined,
    pinIsTemp: (row.pin_is_temp as boolean) ?? false,
  }
}

export async function findUserByEmail(email: string): Promise<StoredUser | undefined> {
  const { data } = await supabase.from('users').select('*').eq('email', email.toLowerCase()).single()
  return data ? toStoredUser(data) : undefined
}

export async function findUserById(id: string): Promise<StoredUser | undefined> {
  const { data } = await supabase.from('users').select('*').eq('id', id).single()
  return data ? toStoredUser(data) : undefined
}

export async function addUser(user: StoredUser): Promise<void> {
  const { error } = await supabase.from('users').insert({
    id: user.id,
    name: user.name,
    email: user.email.toLowerCase(),
    password_hash: user.passwordHash,
    role: user.role,
    specialty: user.specialty,
    phone: user.phone,
    password_is_temp: user.passwordIsTemp ?? true,
    plan_id: 'experimental',
    plan_selected: user.planSelected ?? false,
    credits_remaining: user.creditsRemaining ?? 0,
  })
  if (error) throw new Error(`addUser failed: ${error.message}`)
}

export async function updateUser(
  id: string,
  data: Partial<Pick<StoredUser, 'name' | 'specialty' | 'phone' | 'blocked' | 'passwordHash' | 'minutesPerConsultation' | 'pinHash' | 'passwordIsTemp' | 'pinIsTemp'>>
): Promise<void> {
  const update: Record<string, unknown> = {}
  if (data.name !== undefined)                   update.name                      = data.name
  if (data.specialty !== undefined)              update.specialty                  = data.specialty
  if (data.phone !== undefined)                  update.phone                     = data.phone
  if (data.blocked !== undefined)                update.blocked                   = data.blocked
  if (data.passwordHash !== undefined)           update.password_hash             = data.passwordHash
  if (data.minutesPerConsultation !== undefined) update.minutes_per_consultation  = data.minutesPerConsultation
  if (data.pinHash !== undefined)                update.pin_hash                  = data.pinHash
  if (data.passwordIsTemp !== undefined)         update.password_is_temp          = data.passwordIsTemp
  if (data.pinIsTemp !== undefined)              update.pin_is_temp               = data.pinIsTemp
  await supabase.from('users').update(update).eq('id', id)
}

export async function deleteUser(id: string): Promise<void> {
  await supabase.from('users').delete().eq('id', id)
}

export async function findUsersScheduledForDeletion(): Promise<StoredUser[]> {
  const now = new Date().toISOString()
  const { data } = await supabase
    .from('users')
    .select('*')
    .not('deletion_scheduled_at', 'is', null)
    .lte('deletion_scheduled_at', now)
  return (data ?? []).map(toStoredUser)
}

export async function listUsers(): Promise<StoredUser[]> {
  const { data } = await supabase.from('users').select('*').eq('role', 'user').order('created_at', { ascending: false })
  return (data ?? []).map(toStoredUser)
}

export async function countRegisteredUsers(): Promise<number> {
  const { count } = await supabase.from('users').select('*', { count: 'exact', head: true })
  return count ?? 0
}
