import { testSupabase } from './client'

export function testId(): string {
  return crypto.randomUUID()
}

// ─── Users ────────────────────────────────────────────────────────────────────

type UserSeedOverrides = {
  name?: string
  email?: string
  role?: string
  credits_remaining?: number
  plan_id?: string
  plan_selected?: boolean
  deletion_scheduled_at?: string | null
  bonus_credits?: number
}

export async function seedUser(overrides: UserSeedOverrides = {}) {
  const id = testId()
  const row = {
    id,
    name: 'Integration Test User',
    email: `${id}@integration.test`,
    password_hash: 'test-hash-not-real',
    role: 'user',
    plan_id: 'experimental',
    plan_selected: false,
    onboarding_completed: false,
    password_is_temp: true,
    blocked: false,
    credits_remaining: 5,
    bonus_credits: 0,
    minutes_per_consultation: 45,
    pin_is_temp: false,
    ...overrides,
  }
  const { error } = await testSupabase.from('users').insert(row)
  if (error) throw new Error(`seedUser failed: ${error.message}`)
  return row
}

export async function cleanupUser(id: string): Promise<void> {
  await testSupabase.from('users').delete().eq('id', id)
}

// ─── Access Requests ──────────────────────────────────────────────────────────

type RequestSeedOverrides = {
  name?: string
  email?: string
  specialty?: string
  status?: 'pending' | 'approved' | 'rejected'
}

export async function seedAccessRequest(overrides: RequestSeedOverrides = {}) {
  const id = testId()
  const row = {
    id,
    name: 'Integration Test Doctor',
    email: `${id}@integration.test`,
    specialty: 'Cardiologia',
    phone: '11999990000',
    message: '',
    status: 'pending',
    ...overrides,
  }
  const { error } = await testSupabase.from('access_requests').insert(row)
  if (error) throw new Error(`seedAccessRequest failed: ${error.message}`)
  return row
}

export async function cleanupAccessRequest(id: string): Promise<void> {
  await testSupabase.from('access_requests').delete().eq('id', id)
}
