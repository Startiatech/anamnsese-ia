// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

let currentToken: string | null = null

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => name === 'anamnese_auth' && currentToken ? { name, value: currentToken } : undefined,
  }),
}))

import { POST, DELETE } from '@/app/api/users/me/clinic/logo/route'
import { seedUser, cleanupUser } from '@/tests/integration/seed'
import { signToken } from '@/server/services/auth'
import { supabase } from '@/server/supabase'

const BUCKET = 'clinic-logos'

async function callPOST(userId: string | null, body?: FormData) {
  currentToken = userId ? await signToken({ sub: userId, email: 'x@x.com', name: 'T', role: 'user' }) : null
  const req = new Request('http://localhost/api/users/me/clinic/logo', { method: 'POST', body })
  return POST(req)
}

async function callDELETE(userId: string | null) {
  currentToken = userId ? await signToken({ sub: userId, email: 'x@x.com', name: 'T', role: 'user' }) : null
  return DELETE(new Request('http://localhost/api/users/me/clinic/logo', { method: 'DELETE' }))
}

function pngFile(bytes = 100): File {
  const arr = new Uint8Array(bytes)
  return new File([arr], 'logo.png', { type: 'image/png' })
}

describe('clinic logo endpoint', () => {
  let userId: string
  beforeEach(async () => { userId = (await seedUser()).id })
  afterEach(async () => { await cleanupUser(userId) })

  it('rejeita sem auth', async () => {
    const res = await callPOST(null)
    expect(res.status).toBe(401)
  })

  it('rejeita MIME nao permitido', async () => {
    const fd = new FormData()
    fd.append('file', new File([new Uint8Array(10)], 'a.txt', { type: 'text/plain' }))
    const res = await callPOST(userId, fd)
    expect(res.status).toBe(415)
  })

  it('rejeita arquivo > 2MB', async () => {
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' })
    const fd = new FormData(); fd.append('file', big)
    const res = await callPOST(userId, fd)
    expect(res.status).toBe(413)
  })

  it('upload salva url e path em users', async () => {
    const fd = new FormData(); fd.append('file', pngFile())
    const res = await callPOST(userId, fd)
    expect(res.status).toBe(200)
    const body = await res.json() as { url: string; path: string }
    expect(body.url).toContain(BUCKET)

    const { data } = await supabase.from('users').select('clinic_logo_url, clinic_logo_path').eq('id', userId).single()
    expect(data?.clinic_logo_url).toBe(body.url)
    expect(data?.clinic_logo_path).toBe(body.path)

    // cleanup do bucket
    await supabase.storage.from(BUCKET).remove([body.path])
  })

  it('segundo upload deleta logo anterior', async () => {
    const fd1 = new FormData(); fd1.append('file', pngFile())
    const r1 = await callPOST(userId, fd1)
    const b1 = await r1.json() as { path: string }

    const fd2 = new FormData(); fd2.append('file', pngFile())
    const r2 = await callPOST(userId, fd2)
    const b2 = await r2.json() as { path: string }

    expect(b2.path).not.toBe(b1.path)
    const { data } = await supabase.storage.from(BUCKET).list(userId)
    expect(data?.find((f) => f.name === b1.path.split('/').pop())).toBeUndefined()
    await supabase.storage.from(BUCKET).remove([b2.path])
  })

  it('DELETE zera colunas e remove do bucket', async () => {
    const fd = new FormData(); fd.append('file', pngFile())
    const post = await callPOST(userId, fd)
    const { path } = await post.json() as { path: string }

    const res = await callDELETE(userId)
    expect(res.status).toBe(204)

    const { data } = await supabase.from('users').select('clinic_logo_url, clinic_logo_path').eq('id', userId).single()
    expect(data?.clinic_logo_url).toBeNull()
    expect(data?.clinic_logo_path).toBeNull()
    const list = await supabase.storage.from(BUCKET).list(userId)
    expect(list.data?.find((f) => f.name === path.split('/').pop())).toBeUndefined()
  })
})
