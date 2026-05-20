// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest'
import { addRequest, findRequestByEmail, listRequests, updateRequestStatus } from './requests'
import { seedAccessRequest, cleanupAccessRequest, testId } from '@/tests/integration/seed'
import type { AccessRequest } from '@/lib/types'

describe('requests repository (integration)', () => {
  const created: string[] = []

  afterEach(async () => {
    for (const id of created.splice(0)) await cleanupAccessRequest(id)
  })

  it('addRequest inserts and findRequestByEmail retrieves it', async () => {
    const id = testId()
    created.push(id)
    const request: AccessRequest = {
      id,
      name: 'Dr. Add Request',
      email: `${id}@integration.test`,
      specialty: 'Neurologia',
      phone: '11999990001',
      message: 'Test message',
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    await addRequest(request)
    const found = await findRequestByEmail(request.email)
    expect(found?.id).toBe(id)
    expect(found?.specialty).toBe('Neurologia')
    expect(found?.status).toBe('pending')
  })

  it('findRequestByEmail is case-insensitive', async () => {
    const seeded = await seedAccessRequest()
    created.push(seeded.id)
    const found = await findRequestByEmail(seeded.email.toUpperCase())
    expect(found?.id).toBe(seeded.id)
  })

  it('findRequestByEmail returns undefined for unknown email', async () => {
    expect(await findRequestByEmail('nobody@integration.test')).toBeUndefined()
  })

  it('updateRequestStatus changes status to approved', async () => {
    const seeded = await seedAccessRequest({ status: 'pending' })
    created.push(seeded.id)
    const ok = await updateRequestStatus(seeded.id, 'approved')
    expect(ok).toBe(true)
    const found = await findRequestByEmail(seeded.email)
    expect(found?.status).toBe('approved')
  })

  it('updateRequestStatus changes status to rejected', async () => {
    const seeded = await seedAccessRequest({ status: 'pending' })
    created.push(seeded.id)
    await updateRequestStatus(seeded.id, 'rejected')
    const found = await findRequestByEmail(seeded.email)
    expect(found?.status).toBe('rejected')
  })

  it('listRequests includes recently added request', async () => {
    const seeded = await seedAccessRequest()
    created.push(seeded.id)
    const list = await listRequests()
    expect(list.some((r) => r.id === seeded.id)).toBe(true)
  })
})
