import { describe, it, expect } from 'vitest'
import { generateTempPassword } from './temp-password'

describe('generateTempPassword', () => {
  it('gera 16 caracteres hexadecimais', () => {
    const pwd = generateTempPassword()
    expect(pwd).toMatch(/^[0-9a-f]{16}$/)
  })

  it('gera valores distintos a cada chamada (entropia CSPRNG)', () => {
    const sample = new Set(Array.from({ length: 100 }, () => generateTempPassword()))
    // 64 bits de entropia — colisão em 100 amostras é praticamente impossível
    expect(sample.size).toBe(100)
  })
})
