// Frases que o whisper-large-v3 inventa em silêncio (pt-BR), normalizadas
// (lowercase, sem pontuação final). Só removidas quando isoladas num segmento.
const HALLUCINATION_PHRASES = new Set<string>([
  'tchau',
  'obrigado',
  'obrigada',
  'boa noite',
  'bom dia',
  'boa tarde',
  'ate logo',
  'ate a proxima',
  'obrigado pela atencao',
  'obrigado por assistir',
  'inscreva-se no canal',
  'legendas pela comunidade amara.org',
  'legendas pela comunidade amara org',
])

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .replace(/[.!?…]+$/g, '') // remove pontuação final
    .trim()
}

/**
 * Remove frases de alucinação conhecidas SOMENTE quando ocupam um segmento
 * inteiro (texto completo ou uma linha isolada). Nunca remove a palavra no
 * meio de uma frase real.
 */
export function filterHallucinations(text: string): string {
  if (!text) return ''

  // Caso 1: o texto inteiro é uma alucinação.
  if (HALLUCINATION_PHRASES.has(normalize(text))) return ''

  // Caso 2: linhas isoladas que são alucinação.
  const keptLines = text
    .split('\n')
    .filter(line => !HALLUCINATION_PHRASES.has(normalize(line)))

  return keptLines.join('\n')
}
