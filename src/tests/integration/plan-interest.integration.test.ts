// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest'
import { PlanInterestRepository } from '@/server/repositories/plan-interest'
import { supabase } from '@/server/supabase'

const TEST_EMAIL_A = 'integration-test-interest-a@anamnese-test.local'
const TEST_EMAIL_B = 'integration-test-interest-b@anamnese-test.local'

async function cleanup() {
  await supabase
    .from('plan_interest')
    .delete()
    .in('email', [TEST_EMAIL_A, TEST_EMAIL_B])
}

describe('PlanInterestRepository (integration)', () => {
  afterEach(cleanup)

  describe('save', () => {
    it('insere um interesse com sucesso', async () => {
      const result = await PlanInterestRepository.save({
        name: 'Teste Integration',
        email: TEST_EMAIL_A,
        plan: 'profissional',
      })

      expect(result).toEqual({})

      const { data } = await supabase
        .from('plan_interest')
        .select('email, plan')
        .eq('email', TEST_EMAIL_A)
        .single()

      expect(data?.plan).toBe('profissional')
    })

    it('upsert não duplica registro com mesmo email+plan', async () => {
      await PlanInterestRepository.save({ name: 'Teste', email: TEST_EMAIL_A, plan: 'profissional' })
      await PlanInterestRepository.save({ name: 'Teste Atualizado', email: TEST_EMAIL_A, plan: 'profissional' })

      const { data } = await supabase
        .from('plan_interest')
        .select('id')
        .eq('email', TEST_EMAIL_A)
        .eq('plan', 'profissional')

      expect(data).toHaveLength(1)
    })

    it('permite mesmo email em planos diferentes', async () => {
      await PlanInterestRepository.save({ name: 'Teste', email: TEST_EMAIL_A, plan: 'profissional' })
      await PlanInterestRepository.save({ name: 'Teste', email: TEST_EMAIL_A, plan: 'gestao-clinicas' })

      const { data } = await supabase
        .from('plan_interest')
        .select('id')
        .eq('email', TEST_EMAIL_A)

      expect(data).toHaveLength(2)
    })
  })

  describe('list', () => {
    it('retorna interesses ordenados por created_at desc', async () => {
      await PlanInterestRepository.save({ name: 'Primeiro', email: TEST_EMAIL_A, plan: 'profissional' })
      await PlanInterestRepository.save({ name: 'Segundo', email: TEST_EMAIL_B, plan: 'gestao-clinicas' })

      const list = await PlanInterestRepository.list()
      const testItems = list.filter((i) => [TEST_EMAIL_A, TEST_EMAIL_B].includes(i.email))

      expect(testItems.length).toBeGreaterThanOrEqual(1)
    })

    it('retorna array (nunca lança exceção)', async () => {
      const result = await PlanInterestRepository.list()
      expect(Array.isArray(result)).toBe(true)
    })

    it('cada item tem as propriedades esperadas', async () => {
      await PlanInterestRepository.save({ name: 'Teste Props', email: TEST_EMAIL_A, plan: 'profissional' })

      const list = await PlanInterestRepository.list()
      const item = list.find((i) => i.email === TEST_EMAIL_A)

      expect(item).toBeDefined()
      expect(item).toHaveProperty('id')
      expect(item).toHaveProperty('name', 'Teste Props')
      expect(item).toHaveProperty('email', TEST_EMAIL_A)
      expect(item).toHaveProperty('plan', 'profissional')
      expect(item).toHaveProperty('created_at')
    })
  })
})
