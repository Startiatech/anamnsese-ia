// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { hashPassword, comparePassword, isLegacyHash } from './auth'

describe('hashPassword', () => {
  it('gera hash no formato bcrypt ($2b$)', async () => {
    const hash = await hashPassword('minhasenha')
    expect(hash).toMatch(/^\$2b\$/)
  })

  it('gera hashes diferentes para a mesma senha (salt aleatório)', async () => {
    const h1 = await hashPassword('minhasenha')
    const h2 = await hashPassword('minhasenha')
    expect(h1).not.toBe(h2)
  })
})

describe('comparePassword', () => {
  it('valida senha correta contra hash bcrypt', async () => {
    const hash = await hashPassword('senhaCorreta')
    expect(await comparePassword('senhaCorreta', hash)).toBe(true)
  })

  it('rejeita senha incorreta contra hash bcrypt', async () => {
    const hash = await hashPassword('senhaCorreta')
    expect(await comparePassword('senhaErrada', hash)).toBe(false)
  })

  it('valida senha correta contra hash legado SHA-256', async () => {
    const salt = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'
    const encoder = new TextEncoder()
    const data = encoder.encode(salt + 'senhaLegada')
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    const legacyStored = `${salt}:${hashHex}`
    expect(await comparePassword('senhaLegada', legacyStored)).toBe(true)
  })

  it('rejeita senha incorreta contra hash legado SHA-256', async () => {
    const salt = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'
    const encoder = new TextEncoder()
    const data = encoder.encode(salt + 'senhaCorreta')
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    const legacyStored = `${salt}:${hashHex}`
    expect(await comparePassword('senhaErrada', legacyStored)).toBe(false)
  })
})

describe('isLegacyHash', () => {
  it('identifica hash legado SHA-256 (formato saltHex:hashHex)', () => {
    expect(isLegacyHash('abc123:def456')).toBe(true)
  })

  it('identifica hash bcrypt como não-legado', () => {
    expect(isLegacyHash('$2b$10$abcdefghijklmnopqrstuvwxyz')).toBe(false)
  })
})
