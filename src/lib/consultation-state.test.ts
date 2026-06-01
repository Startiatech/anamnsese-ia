import { describe, it, expect } from 'vitest'
import { resolveTerminalState } from './consultation-state'

describe('resolveTerminalState', () => {
  it('abandona e devolve quando sem IA, sem anamnese anterior e com debit_source', () => {
    expect(resolveTerminalState({ audio_attempts: 0, structured_anamnesis: { sections: [] }, debit_source: 'paid' }))
      .toEqual({ status: 'abandoned', refundSource: 'paid' })
  })

  it('abandona sem devolver quando houve IA (audio_attempts > 0) e sem anamnese anterior', () => {
    expect(resolveTerminalState({ audio_attempts: 2, structured_anamnesis: { sections: [] }, debit_source: 'paid' }))
      .toEqual({ status: 'abandoned', refundSource: null })
  })

  it('volta para completed (preserva histórico) quando já havia anamnese anterior', () => {
    expect(resolveTerminalState({ audio_attempts: 0, structured_anamnesis: { sections: [{ title: 'HDA', content: 'x' }] }, debit_source: 'bonus' }))
      .toEqual({ status: 'completed', refundSource: 'bonus' })
  })

  it('completed com IA usada não devolve crédito', () => {
    expect(resolveTerminalState({ audio_attempts: 1, structured_anamnesis: { sections: [{ title: 'HDA', content: 'x' }] }, debit_source: 'paid' }))
      .toEqual({ status: 'completed', refundSource: null })
  })

  it('sem debit_source nunca devolve', () => {
    expect(resolveTerminalState({ audio_attempts: 0, structured_anamnesis: null, debit_source: null }))
      .toEqual({ status: 'abandoned', refundSource: null })
  })

  it('trata structured_anamnesis null/sem sections como sem anamnese', () => {
    expect(resolveTerminalState({ audio_attempts: 0, structured_anamnesis: null, debit_source: 'paid' }).status).toBe('abandoned')
    expect(resolveTerminalState({ audio_attempts: 0, structured_anamnesis: {}, debit_source: 'paid' }).status).toBe('abandoned')
  })
})
