'use server'

import { getServerUser } from '@/server/services/session'
import { findUserById, updateUser } from '@/server/repositories/users'
import { comparePassword, hashPassword } from '@/server/services/auth'
import { masterProfileSchema, masterPasswordChangeSchema } from '@/lib/schemas'

interface ProfileInput {
  name: string
  phone?: string
  currentPassword?: string
  newPassword?: string
  confirmPassword?: string
}

export async function updateMasterProfile(
  data: ProfileInput
): Promise<{ ok: boolean; error?: string }> {
  const sessionUser = await getServerUser()
  if (!sessionUser || sessionUser.role !== 'master') {
    return { ok: false, error: 'Forbidden' }
  }

  const parsed = masterProfileSchema.safeParse({ name: data.name, phone: data.phone })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }
  const { name, phone } = parsed.data

  const userId = sessionUser.sub
  const { currentPassword, newPassword, confirmPassword } = data

  if (newPassword) {
    const parsedPassword = masterPasswordChangeSchema.safeParse({
      currentPassword,
      newPassword,
      confirmPassword,
    })
    if (!parsedPassword.success) {
      return { ok: false, error: parsedPassword.error.issues[0]?.message ?? 'Senha inválida.' }
    }
    const user = await findUserById(userId)
    if (!user) return { ok: false, error: 'Usuário não encontrado.' }

    const valid = await comparePassword(currentPassword ?? '', user.passwordHash)
    if (!valid) return { ok: false, error: 'Senha atual incorreta.' }

    const newHash = await hashPassword(newPassword)
    await updateUser(userId, { name, phone, passwordHash: newHash })
    return { ok: true }
  }

  await updateUser(userId, { name, phone })
  return { ok: true }
}
