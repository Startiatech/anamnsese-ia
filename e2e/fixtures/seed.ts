import { getTestSupabase } from './supabase'
import { makeE2eId } from './auth'

export interface E2ePatient {
  id: string
  userId: string
  name: string
  cpf: string
}

function generateCpf(): string {
  // CPF aleatorio NAO validado (banco nao valida digitos)
  const n = () => Math.floor(Math.random() * 10).toString()
  return Array.from({ length: 11 }, n).join('')
}

export async function createPatient(userId: string, overrides?: Partial<E2ePatient>): Promise<E2ePatient> {
  const id = makeE2eId('e2e-pat')
  const name = overrides?.name ?? `E2E_Patient_${id}`
  const cpf = overrides?.cpf ?? generateCpf()

  const supabase = getTestSupabase()
  const { data, error } = await supabase
    .from('patients')
    .insert({ user_id: userId, name, cpf })
    .select('id, user_id, name, cpf')
    .single()

  if (error || !data) {
    throw new Error(`[e2e] createPatient falhou: ${error?.message}`)
  }

  return { id: data.id, userId: data.user_id, name: data.name, cpf: data.cpf }
}

/**
 * Preenche dados de clinica para o usuario passar no guard `isClinicComplete`.
 * Sem isso, `/consultation/[id]` redireciona para `/settings?force=clinica`.
 * Usado nos specs de consultation flow.
 */
export async function seedClinicForUser(userId: string): Promise<void> {
  const supabase = getTestSupabase()
  const { error } = await supabase
    .from('users')
    .update({
      clinic_name:           'E2E Clinica',
      clinic_cnpj:           '11222333000181',
      clinic_address:        'Rua de Teste, 100',
      clinic_address_number: '100',
      clinic_cep:            '01001000',
      clinic_phone:          '11999990000',
      clinic_email:          'e2e-clinic@test.com',
      clinic_rt_is_self:     true,
    })
    .eq('id', userId)
  if (error) throw new Error(`[e2e] seedClinicForUser falhou: ${error.message}`)
}

export async function createAccessRequest(): Promise<{ id: string; email: string }> {
  const uniqueId = makeE2eId('e2e-req')
  const email = `${uniqueId}@test.com`
  const supabase = getTestSupabase()
  const { data, error } = await supabase
    .from('access_requests')
    .insert({
      name: `E2E ${uniqueId}`,
      email,
      specialty: 'Clinico Geral',
      phone: '11999990000',
      message: 'Teste E2E',
      status: 'pending',
    })
    .select('id, email')
    .single()

  if (error || !data) {
    throw new Error(`[e2e] createAccessRequest falhou: ${error?.message}`)
  }

  return { id: data.id, email: data.email }
}

export async function cleanupE2eData(): Promise<void> {
  const supabase = getTestSupabase()

  const { data: users } = await supabase
    .from('users')
    .select('id')
    .like('email', 'e2e-%@test.com')

  const ids = (users ?? []).map((u) => u.id)

  if (ids.length > 0) {
    await supabase.from('api_usage_log').delete().in('user_id', ids)
    await supabase.from('consultations').delete().in('user_id', ids)
    await supabase.from('patients').delete().in('user_id', ids)
    await supabase.from('feedbacks').delete().in('user_id', ids)
    await supabase.from('users').delete().in('id', ids)
  }

  await supabase.from('access_requests').delete().like('email', 'e2e-%@test.com')
  await supabase.from('plan_interest').delete().like('email', 'e2e-%@test.com')

  console.log(`[e2e] cleanup: ${ids.length} usuarios removidos + dados associados`)
}
