import { NextResponse } from 'next/server'
import { verifyToken, hashPassword, COOKIE_NAME } from '@/server/services/auth'
import { findUserById, updateUser } from '@/server/repositories/users'
import { cookies } from 'next/headers'

function generatePin(): string {
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  return String(array[0] % 900000 + 100000).padStart(6, '0')
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  const payload = token ? await verifyToken(token) : null

  if (!payload) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (payload.role !== 'admin' && payload.role !== 'master') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const user = await findUserById(id)
  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  const pin = generatePin()
  const pinHash = await hashPassword(pin)
  await updateUser(id, { pinHash, pinIsTemp: true })

  return NextResponse.json({ ok: true, pin, name: user.name, phone: user.phone })
}
