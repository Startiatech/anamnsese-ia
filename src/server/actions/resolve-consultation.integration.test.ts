// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest'
import { testSupabase } from '@/tests/integration/client'
import { seedUser, seedPatient, seedConsultation, cleanupUserCascade } from '@/tests/integration/seed'

// Valida a RPC resolve_consultation contra o banco REAL: transição terminal
// atômica + idempotência (FOR UPDATE) + devolução do debit_source antigo só para
// quem vence a corrida. É a peça crítica de dinheiro que o teste unitário (mock)
// não consegue exercitar — aqui o SQL roda de verdade.

async function getConsultation(userId: string, patientId: string) {
  const { data } = await testSupabase
    .from('consultations')
    .select('status, debit_source, raw_transcript')
    .eq('user_id', userId)
    .eq('patient_id', patientId)
    .single()
  return data
}

describe('resolve_consultation (integration)', () => {
  const created: string[] = []

  afterEach(async () => {
    for (const id of created.splice(0)) await cleanupUserCascade(id)
  })

  it('transiciona in_progress → status informado, limpa raw_transcript e zera debit_source, e retorna o debit_source antigo', async () => {
    const user = await seedUser()
    created.push(user.id)
    const patient = await seedPatient(user.id)
    await seedConsultation(user.id, patient.id, { status: 'in_progress', debit_source: 'paid', raw_transcript: 'algo' })

    const { data, error } = await testSupabase.rpc('resolve_consultation', {
      p_user_id: user.id,
      p_patient_id: patient.id,
      p_new_status: 'abandoned',
    })

    expect(error).toBeNull()
    expect(data).toBe('paid')

    const row = await getConsultation(user.id, patient.id)
    expect(row?.status).toBe('abandoned')
    expect(row?.debit_source).toBeNull()
    expect(row?.raw_transcript).toBeNull()
  })

  it('IDEMPOTÊNCIA: segunda chamada na mesma linha já resolvida retorna NULL (não devolve crédito duas vezes)', async () => {
    const user = await seedUser()
    created.push(user.id)
    const patient = await seedPatient(user.id)
    await seedConsultation(user.id, patient.id, { status: 'in_progress', debit_source: 'bonus' })

    const first = await testSupabase.rpc('resolve_consultation', {
      p_user_id: user.id, p_patient_id: patient.id, p_new_status: 'abandoned',
    })
    const second = await testSupabase.rpc('resolve_consultation', {
      p_user_id: user.id, p_patient_id: patient.id, p_new_status: 'abandoned',
    })

    expect(first.data).toBe('bonus')   // venceu
    expect(second.data).toBeNull()     // perdeu — linha não está mais in_progress
  })

  it('permite transicionar para completed (preserva caminho de histórico)', async () => {
    const user = await seedUser()
    created.push(user.id)
    const patient = await seedPatient(user.id)
    await seedConsultation(user.id, patient.id, { status: 'in_progress', debit_source: 'paid' })

    const { data } = await testSupabase.rpc('resolve_consultation', {
      p_user_id: user.id, p_patient_id: patient.id, p_new_status: 'completed',
    })

    expect(data).toBe('paid')
    const row = await getConsultation(user.id, patient.id)
    expect(row?.status).toBe('completed')
  })

  it('retorna NULL quando não há atendimento in_progress', async () => {
    const user = await seedUser()
    created.push(user.id)
    const patient = await seedPatient(user.id)
    await seedConsultation(user.id, patient.id, { status: 'completed', debit_source: null })

    const { data } = await testSupabase.rpc('resolve_consultation', {
      p_user_id: user.id, p_patient_id: patient.id, p_new_status: 'abandoned',
    })

    expect(data).toBeNull()
  })
})
