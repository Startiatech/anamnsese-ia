import type { AccessRequest } from '@/lib/types'

type DuplicateResult =
  | null
  | { block: true; status: 'pending' | 'approved' }
  | { block: false; status: 'rejected' }

/**
 * Determina se uma solicitação existente deve bloquear uma nova.
 *
 * - rejected  → não bloqueia (pode tentar de novo)
 * - approved + usuário deletado → não bloqueia (conta foi removida, email está livre)
 * - approved + usuário existe   → bloqueia
 * - pending                     → bloqueia
 */
export function checkDuplicateRequest(
  existing: AccessRequest | undefined,
  userExists = true,
): DuplicateResult {
  if (!existing) return null
  if (existing.status === 'rejected') return { block: false, status: 'rejected' }
  if (existing.status === 'approved' && !userExists) return null
  return { block: true, status: existing.status as 'pending' | 'approved' }
}
