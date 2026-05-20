import { NextRequest, NextResponse } from 'next/server'
import { findUserByEmail, updateUser } from '@/server/repositories/users'
import { comparePin, signToken, COOKIE_NAME } from '@/server/services/auth'
import { forgotPasswordSchema } from '@/lib/schemas'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = forgotPasswordSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const { email, pin } = parsed.data

  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const limited = await checkRateLimit(`forgot:${ip}:${email}`)
  if (limited) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 })
  }
  const user = await findUserByEmail(email)

  // Mensagem genérica para não revelar se o email existe
  const unauthorized = NextResponse.json(
    { error: 'Email ou PIN incorretos' },
    { status: 401 },
  )

  if (!user || !user.pinHash) return unauthorized

  const valid = await comparePin(pin, user.pinHash)
  if (!valid) return unauthorized

  // Marca no banco para o layout guard redirecionar para /settings
  await updateUser(user.id, { passwordIsTemp: true })

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
    hasPin: true,
    passwordIsTemp: true,
  })

  const response = NextResponse.json({ ok: true })

  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })

  return response
}
