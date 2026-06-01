export interface TerminalStateInput {
  audio_attempts?: number | null
  structured_anamnesis?: unknown
  debit_source?: 'bonus' | 'paid' | null
}

export interface TerminalStateResult {
  status: 'completed' | 'abandoned'
  refundSource: 'bonus' | 'paid' | null
}

function hasAnamnesis(anamnesis: unknown): boolean {
  if (!anamnesis || typeof anamnesis !== 'object') return false
  const sections = (anamnesis as { sections?: unknown }).sections
  return Array.isArray(sections) && sections.length > 0
}

/**
 * Decide o estado terminal de um atendimento a partir do estado do banco.
 * - completed: já havia anamnese concluída (preserva o histórico clínico).
 * - abandoned: nunca houve anamnese.
 * Devolve crédito apenas se um crédito foi debitado (debit_source) e nenhuma
 * IA foi usada (audio_attempts === 0).
 */
export function resolveTerminalState(input: TerminalStateInput): TerminalStateResult {
  const aiUsed = (input.audio_attempts ?? 0) > 0
  const status: 'completed' | 'abandoned' = hasAnamnesis(input.structured_anamnesis) ? 'completed' : 'abandoned'
  const refundSource = !aiUsed && input.debit_source ? input.debit_source : null
  return { status, refundSource }
}
