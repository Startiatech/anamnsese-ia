import { NextRequest, NextResponse } from 'next/server'
import { findUserByEmail } from '@/lib/users'
import { comparePassword, signToken, isLegacyHash, hashPassword, COOKIE_NAME } from '@/lib/auth'
import { updateUser } from '@/lib/users'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const { email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 })
  }

  const limited = await checkRateLimit(`login:${ip}:${email}`)
  if (limited) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
      { status: 429 },
    )
  }

  const user = await findUserByEmail(email)

  if (!user) {
    return NextResponse.json({ error: 'Email ou senha incorretos' }, { status: 401 })
  }

  const valid = await comparePassword(password, user.passwordHash)

  if (!valid) {
    return NextResponse.json({ error: 'Email ou senha incorretos' }, { status: 401 })
  }

  // Migração progressiva: re-hash com bcrypt se ainda usa SHA-256
  if (isLegacyHash(user.passwordHash)) {
    const newHash = await hashPassword(password)
    await updateUser(user.id, { passwordHash: newHash })
  }

  const token = await signToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    planId: user.planId,
    specialty: user.specialty,
    crmType: user.crmType,
    crmNumber: user.crmNumber,
    crmUf: user.crmUf,
    hasPin: !!user.pinHash,
  })

  const redirectTo = user.role === 'admin' || user.role === 'master' ? '/console' : '/dashboard'
  const response = NextResponse.json({ ok: true, redirectTo })

  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 dias
    path: '/',
  })

  return response
}
