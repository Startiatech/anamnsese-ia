// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { hashPassword, comparePassword, signToken, verifyToken } from './auth'

describe('hashPassword', () => {
  it('returns bcrypt format ($2b$)', async () => {
    const result = await hashPassword('mypassword')
    expect(result).toMatch(/^\$2b\$/)
  })

  it('produces different hashes for the same password (random salt)', async () => {
    const h1 = await hashPassword('same')
    const h2 = await hashPassword('same')
    expect(h1).not.toBe(h2)
  })
})

describe('comparePassword', () => {
  it('returns true when password matches stored hash', async () => {
    const stored = await hashPassword('correct-password')
    expect(await comparePassword('correct-password', stored)).toBe(true)
  })

  it('returns false when password does not match', async () => {
    const stored = await hashPassword('correct-password')
    expect(await comparePassword('wrong-password', stored)).toBe(false)
  })

  it('returns false when stored hash is malformed', async () => {
    expect(await comparePassword('any', 'notahash')).toBe(false)
  })

  it('returns false when stored hash is empty', async () => {
    expect(await comparePassword('any', '')).toBe(false)
  })
})

describe('signToken / verifyToken', () => {
  it('roundtrip: verify returns the original payload', async () => {
    const payload = { sub: 'user-123', email: 'a@b.com', name: 'Ana', role: 'user' as const }
    const token = await signToken(payload)
    const result = await verifyToken(token)
    expect(result?.sub).toBe('user-123')
    expect(result?.email).toBe('a@b.com')
    expect(result?.name).toBe('Ana')
    expect(result?.role).toBe('user')
  })

  it('verifyToken returns null for a tampered token', async () => {
    const token = await signToken({ sub: 'x', email: 'x@x.com', name: 'X', role: 'user' })
    const tampered = token.slice(0, -5) + 'XXXXX'
    expect(await verifyToken(tampered)).toBeNull()
  })

  it('verifyToken returns null for an empty string', async () => {
    expect(await verifyToken('')).toBeNull()
  })

  it('verifyToken returns null for a random string', async () => {
    expect(await verifyToken('not.a.jwt')).toBeNull()
  })
})
