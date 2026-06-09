import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/server/services/session'
import { hashPassword } from '@/server/services/auth'
import { generateTempPassword } from '@/lib/temp-password'
import { findRequestById } from '@/server/repositories/requests'
import { findUserByEmail, updateUser } from '@/server/repositories/users'

/**
 * Regenera a senha temporaria de uma solicitacao aprovada e a retorna UMA vez,
 * para reenvio (ex.: master fechou o WhatsApp sem enviar e precisa recuperar).
 *
 * Nao ha senha em texto plano armazenada: geramos uma nova (CSPRNG), persistimos
 * apenas o hash, e devolvemos o plaintext somente nesta resposta. Disponivel
 * apenas enquanto password_is_temp=true — se o usuario ja definiu a propria
 * senha, regenerar sequestraria a conta dele.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin' && session.role !== 'master') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await ctx.params

  const request = await findRequestById(id)
  if (!request) {
    return NextResponse.json({ error: 'Solicitação não encontrada' }, { status: 404 })
  }
  if (request.status !== 'approved') {
    return NextResponse.json({ error: 'Solicitação não está aprovada' }, { status: 400 })
  }

  const user = await findUserByEmail(request.email)
  if (!user) {
    return NextResponse.json({ error: 'Usuário associado não encontrado' }, { status: 404 })
  }
  if (!user.passwordIsTemp) {
    return NextResponse.json(
      { error: 'Usuário já definiu a própria senha — não é possível regenerar' },
      { status: 410 },
    )
  }

  const password = generateTempPassword()
  const passwordHash = await hashPassword(password)
  await updateUser(user.id, { passwordHash, passwordIsTemp: true })

  return NextResponse.json({
    ok: true,
    password,
    name: request.name,
    email: request.email,
    phone: request.phone,
  })
}
