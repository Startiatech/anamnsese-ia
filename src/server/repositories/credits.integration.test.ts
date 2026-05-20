// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest'
import { CreditRepository } from './credits'
import { seedUser, cleanupUser } from '@/tests/integration/seed'

describe('CreditRepository (integration)', () => {
  const created: string[] = []

  afterEach(async () => {
    for (const id of created.splice(0)) await cleanupUser(id)
  })

  it('getCredits returns credits_remaining from DB', async () => {
    const user = await seedUser({ credits_remaining: 7 })
    created.push(user.id)
    expect(await CreditRepository.getCredits(user.id)).toBe(7)
  })

  it('getCredits returns 0 for unknown user', async () => {
    expect(await CreditRepository.getCredits('nonexistent-id-000')).toBe(0)
  })

  it('setCredits updates value in DB', async () => {
    const user = await seedUser({ credits_remaining: 0 })
    created.push(user.id)
    await CreditRepository.setCredits(user.id, 10)
    expect(await CreditRepository.getCredits(user.id)).toBe(10)
  })

  it('setCredits clamps negative to 0', async () => {
    const user = await seedUser({ credits_remaining: 5 })
    created.push(user.id)
    await CreditRepository.setCredits(user.id, -3)
    expect(await CreditRepository.getCredits(user.id)).toBe(0)
  })

  it('debitCredit decrements credits via SQL RPC', async () => {
    const user = await seedUser({ credits_remaining: 3 })
    created.push(user.id)
    await CreditRepository.debitCredit(user.id)
    expect(await CreditRepository.getCredits(user.id)).toBe(2)
  })

  it('debitCredit does not go below 0', async () => {
    const user = await seedUser({ credits_remaining: 0 })
    created.push(user.id)
    await CreditRepository.debitCredit(user.id)
    expect(await CreditRepository.getCredits(user.id)).toBe(0)
  })
})
