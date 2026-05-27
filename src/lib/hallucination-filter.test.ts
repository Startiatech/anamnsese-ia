// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { filterHallucinations } from './hallucination-filter'

describe('filterHallucinations', () => {
  it('removes a known phrase when it is the entire segment', () => {
    expect(filterHallucinations('Tchau')).toBe('')
  })

  it('removes known phrase case-insensitively and trimming spaces', () => {
    expect(filterHallucinations('  OBRIGADO.  ')).toBe('')
  })

  it('preserves "obrigado" inside a real sentence', () => {
    const input = 'O paciente disse obrigado ao final da consulta.'
    expect(filterHallucinations(input)).toBe(input)
  })

  it('removes a hallucinated line but keeps the real lines', () => {
    const input = 'Paciente refere dor torácica.\nLegendas pela comunidade Amara.org\nNega febre.'
    expect(filterHallucinations(input)).toBe('Paciente refere dor torácica.\nNega febre.')
  })

  it('returns empty string for empty input', () => {
    expect(filterHallucinations('')).toBe('')
  })

  it('keeps normal medical text untouched', () => {
    const input = 'Pressão arterial 120 por 80. Ausculta sem alterações.'
    expect(filterHallucinations(input)).toBe(input)
  })
})
