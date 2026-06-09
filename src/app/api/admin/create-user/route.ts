// src/app/api/admin/create-user/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyToken, hashPassword, COOKIE_NAME } from '@/lib/auth'
import { addUser, findUserByEmail } from '@/lib/users'
import { createUserSchema } from '@/lib/schemas'
import { supabase } from '@/server/supabase'

const createUserApiSchema = createUserSchema.extend({
  password: z.string().min(8, 'Mínimo 8 caracteres').max(200).trim(),
})

export async function POST(req: NextRequest) {
  // Verificar se é admin
  const token = req.cookies.get(COOKIE_NAME)?.value
  const payload = token ? await verifyToken(token) : null

  if (!payload || (payload.role !== 'admin' && payload.role !== 'master')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = createUserApiSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }

  const { name, email, specialty, phone, password } = parsed.data

  if (await findUserByEmail(email)) {
    return NextResponse.json({ error: 'Email já cadastrado' }, { status: 409 })
  }

  const passwordHash = await hashPassword(password)

  const { data: plan } = await supabase.from('plans').select('quota').eq('id', 'experimental').single()
  const creditsRemaining = (plan?.quota as number) ?? 5

  const userId = crypto.randomUUID()
  await addUser({
    id: userId,
    name,
    email,
    passwordHash,
    role: 'user',
    specialty,
    phone,
    planSelected: true,
    passwordIsTemp: true,
    onboardingCompleted: false,
    createdAt: new Date().toISOString(),
    creditsRemaining,
    planId: 'experimental',
    blocked: false,
    deletionScheduledAt: null,
    bonusCredits: 0,
    minutesPerConsultation: 45,
    pinIsTemp: false,
    clinicRtIsSelf: true,
    prefFontSize: 'normal',
    prefHighContrast: false,
    prefSpacingIncreased: false,
    prefFocusHighlight: false,
    prefExtraReducedMotion: false,
  })

  return NextResponse.json({ ok: true })
}
