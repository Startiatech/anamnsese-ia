import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/server/services/session'
import { supabase } from '@/server/supabase'
import { comparePassword, hashPassword } from '@/server/services/auth'
import { findUserById } from '@/server/repositories/users'

export async function PATCH(req: NextRequest) {
  const payload = await getServerUser()
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // ─── Atualização de senha ─────────────────────────────────────────────────
  if (body.newPassword) {
    const user = await findUserById(payload.sub)
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Senha temporária (reset via PIN): não exige senha atual
    if (!user.passwordIsTemp) {
      if (!body.currentPassword) return NextResponse.json({ error: 'Informe a senha atual' }, { status: 400 })
      const valid = await comparePassword(body.currentPassword, user.passwordHash)
      if (!valid) return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 })
    }

    const newHash = await hashPassword(body.newPassword)
    await supabase.from('users').update({ password_hash: newHash, password_is_temp: false }).eq('id', payload.sub)
    return NextResponse.json({ ok: true })
  }

  // ─── Atualização de perfil ────────────────────────────────────────────────
  const { name, phone, specialty, crmType, crmNumber, crmUf, minutesPerConsultation } = body

  const profileIsComplete =
    typeof specialty === 'string' && specialty.length > 0 &&
    typeof crmNumber === 'string' && crmNumber.length > 0 &&
    typeof crmUf === 'string' && crmUf.length > 0

  const updateData: Record<string, unknown> = {
    name,
    phone,
    specialty,
    crm_type:   crmType,
    crm_number: crmNumber,
    crm_uf:     crmUf,
  }

  if (typeof minutesPerConsultation === 'number' && minutesPerConsultation > 0) {
    updateData.minutes_per_consultation = minutesPerConsultation
  }

  if (profileIsComplete) {
    updateData.onboarding_completed = true
  }

  await supabase.from('users').update(updateData).eq('id', payload.sub)

  return NextResponse.json({ ok: true, onboardingCompleted: profileIsComplete })
}
