'use server'

import { getServerUser } from '@/server/services/session'
import { updateAccessibilityPrefs } from '@/server/repositories/users'
import { accessibilityPrefsSchema, type AccessibilityPrefsFormData } from '@/lib/schemas'

export async function updateAccessibilityAction(
  input: Partial<AccessibilityPrefsFormData>
): Promise<{ ok: boolean; error?: string }> {
  const session = await getServerUser()
  if (!session) return { ok: false, error: 'Unauthorized' }

  const parsed = accessibilityPrefsSchema.safeParse(input)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Dados inválidos'
    return { ok: false, error: message }
  }

  try {
    await updateAccessibilityPrefs(session.sub, parsed.data)
    return { ok: true }
  } catch {
    return { ok: false, error: 'Erro ao salvar preferências' }
  }
}
