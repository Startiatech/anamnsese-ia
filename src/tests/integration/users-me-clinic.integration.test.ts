// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

let currentToken: string | null = null

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => name === 'anamnese_auth' && currentToken ? { name, value: currentToken } : undefined,
  }),
}))

import { PATCH } from '@/app/api/users/me/route'
import { seedUser, cleanupUser } from '@/tests/integration/seed'
import { signToken } from '@/server/services/auth'
import { findUserById } from '@/server/repositories/users'

async function authed(userId: string, payload: unknown): Promise<Request> {
  currentToken = await signToken({ sub: userId, email: 'x@x.com', name: 'Test', role: 'user' })
  return new Request('http://localhost/api/users/me', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

const validClinic = {
  clinicName: 'Clinica X',
  clinicCnpj: '11222333000181',
  clinicAddress: 'Rua A, 100',
  clinicCep: '01000000',
  clinicPhone: '(11) 99999-9999',
  clinicEmail: 'c@x.com',
  clinicWebsite: 'clinica.com.br',
  clinicRtIsSelf: true,
  clinicBusinessHours: 'Seg-Sex 8h-18h',
}

describe('PATCH /api/users/me com campos clinic', () => {
  let userId: string
  beforeEach(async () => { userId = (await seedUser()).id })
  afterEach(async () => { await cleanupUser(userId) })

  it('aceita payload misto (perfil + clinic)', async () => {
    const res = await PATCH(await authed(userId, { name: 'Novo Nome', ...validClinic }))
    expect(res.status).toBe(200)
    const u = await findUserById(userId)
    expect(u?.name).toBe('Novo Nome')
    expect(u?.clinicName).toBe('Clinica X')
    expect(u?.clinicCnpj).toBe('11222333000181')
    expect(u?.clinicWebsite).toBe('https://clinica.com.br')
  })

  it('rejeita CNPJ invalido', async () => {
    const res = await PATCH(await authed(userId, { ...validClinic, clinicCnpj: '11222333000180' }))
    expect(res.status).toBe(400)
  })

  it('rejeita RT incompleto quando clinicRtIsSelf = false', async () => {
    const res = await PATCH(await authed(userId, { ...validClinic, clinicRtIsSelf: false }))
    expect(res.status).toBe(400)
  })
})
