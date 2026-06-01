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

// ─── Patients ───────────────────────────────────────────────────────────────

export async function seedPatient(userId: string, overrides: { name?: string; cpf?: string } = {}) {
  const id = testId()
  const row = {
    id,
    user_id: userId,
    name: 'Integration Patient',
    cpf: id.replace(/\D/g, '').slice(0, 11).padEnd(11, '0'),
    ...overrides,
  }
  const { error } = await testSupabase.from('patients').insert(row)
  if (error) throw new Error(`seedPatient failed: ${error.message}`)
  return row
}

// ─── Consultations ────────────────────────────────────────────────────────────

type ConsultationSeedOverrides = {
  status?: 'in_progress' | 'abandoned' | 'completed'
  debit_source?: 'bonus' | 'paid' | null
  audio_attempts?: number
  raw_transcript?: string | null
  structured_anamnesis?: unknown
  updated_at?: string
}

export async function seedConsultation(
  userId: string,
  patientId: string,
  overrides: ConsultationSeedOverrides = {},
) {
  const row = {
    user_id: userId,
    patient_id: patientId,
    status: 'in_progress',
    debit_source: 'paid',
    audio_attempts: 0,
    raw_transcript: 'transcrição de teste',
    ...overrides,
  }
  const { error } = await testSupabase
    .from('consultations')
    .upsert(row, { onConflict: 'user_id,patient_id' })
  if (error) throw new Error(`seedConsultation failed: ${error.message}`)
  return row
}

// Remove consultations + patients + user respeitando as FKs (sem cascade no schema).
export async function cleanupUserCascade(userId: string): Promise<void> {
  await testSupabase.from('consultations').delete().eq('user_id', userId)
  await testSupabase.from('patients').delete().eq('user_id', userId)
  await testSupabase.from('users').delete().eq('id', userId)
}
