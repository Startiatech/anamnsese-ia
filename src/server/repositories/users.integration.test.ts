// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest'
import { findUserById, findUserByEmail, addUser, updateUser, deleteUser } from './users'
import { seedUser, cleanupUser, testId } from '@/tests/integration/seed'
import type { StoredUser } from './users'

describe('users repository (integration)', () => {
  const created: string[] = []

  afterEach(async () => {
    for (const id of created.splice(0)) await cleanupUser(id)
  })

  it('findUserById returns seeded user with correct mapping', async () => {
    const seeded = await seedUser({ name: 'Dr. Integration' })
    created.push(seeded.id)
    const found = await findUserById(seeded.id)
    expect(found?.name).toBe('Dr. Integration')
    expect(found?.email).toBe(seeded.email)
    expect(found?.role).toBe('user')
  })

  it('findUserById returns undefined for unknown id', async () => {
    expect(await findUserById('nonexistent-id-000')).toBeUndefined()
  })

  it('findUserByEmail returns user regardless of case', async () => {
    const seeded = await seedUser()
    created.push(seeded.id)
    const found = await findUserByEmail(seeded.email.toUpperCase())
    expect(found?.id).toBe(seeded.id)
  })

  it('findUserByEmail returns undefined for unknown email', async () => {
    expect(await findUserByEmail('nobody@integration.test')).toBeUndefined()
  })

  it('addUser inserts and findUserById retrieves it', async () => {
    const id = testId()
    created.push(id)
    const newUser: StoredUser = {
      id,
      name: 'Dr. AddUser',
      email: `${id}@integration.test`,
      passwordHash: 'hash-add',
      role: 'user',
      planId: 'experimental',
      planSelected: false,
      onboardingCompleted: false,
      passwordIsTemp: true,
      blocked: false,
      createdAt: new Date().toISOString(),
      creditsRemaining: 3,
      deletionScheduledAt: null,
      bonusCredits: 0,
      minutesPerConsultation: 45,
      pinIsTemp: false,
    }
    await addUser(newUser)
    const found = await findUserById(id)
    expect(found?.name).toBe('Dr. AddUser')
    expect(found?.passwordIsTemp).toBe(true)
    expect(found?.creditsRemaining).toBe(3)
  })

  it('updateUser persists name change to DB', async () => {
    const seeded = await seedUser({ name: 'Before' })
    created.push(seeded.id)
    await updateUser(seeded.id, { name: 'After' })
    const found = await findUserById(seeded.id)
    expect(found?.name).toBe('After')
  })

  it('updateUser persists blocked flag to DB', async () => {
    const seeded = await seedUser()
    created.push(seeded.id)
    await updateUser(seeded.id, { blocked: true })
    const found = await findUserById(seeded.id)
    expect(found?.blocked).toBe(true)
  })

  it('deleteUser removes the user from DB', async () => {
    const seeded = await seedUser()
    await deleteUser(seeded.id)
    expect(await findUserById(seeded.id)).toBeUndefined()
  })
})
