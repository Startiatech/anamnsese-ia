import { NextResponse } from 'next/server'
import { getServerUser } from '@/server/services/session'
import { hashPassword } from '@/server/services/auth'
import { updateUser } from '@/server/repositories/users'
import { setPinSchema } from '@/lib/schemas'

export async function PATCH(req: Request) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const parsed = setPinSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }

  const pinHash = await hashPassword(parsed.data.pin)
  await updateUser(user.sub, { pinHash, pinIsTemp: false })

  return NextResponse.json({ ok: true })
}
