import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/server/services/session'
import { supabase } from '@/server/supabase'
import { comparePassword, hashPassword } from '@/server/services/auth'
import { findUserById, updateClinicData } from '@/server/repositories/users'
import { clinicSchema } from '@/lib/schemas'

export async function PATCH(req: NextRequest) {
  const payload = await getServerUser()
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as Record<string, unknown>

  // ─── Atualização de dados da clínica ─────────────────────────────────────
  const hasClinicFields = Object.keys(body).some((k) => k.startsWith('clinic'))

  if (hasClinicFields) {
    const parsed = clinicSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Dados da clínica inválidos'
      return NextResponse.json({ error: message }, { status: 400 })
    }
    await updateClinicData(payload.sub, parsed.data)
  }

  // Remove chaves clinic* do body para não interferir no processamento de perfil/senha
  const profileBody = Object.fromEntries(
    Object.entries(body).filter(([k]) => !k.startsWith('clinic'))
  )

  // ─── Atualização de senha ─────────────────────────────────────────────────
  if (profileBody.newPassword) {
    const user = await findUserById(payload.sub)
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Senha temporária (reset via PIN): não exige senha atual
    if (!user.passwordIsTemp) {
      if (!profileBody.currentPassword) return NextResponse.json({ error: 'Informe a senha atual' }, { status: 400 })
      const valid = await comparePassword(profileBody.currentPassword as string, user.passwordHash)
      if (!valid) return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 })
    }

    const newHash = await hashPassword(profileBody.newPassword as string)
    // Limpa a senha temporaria em texto plano: usuario agora tem senha propria,
    // master nao precisa mais (e nao deve) ver a antiga via "Ver credenciais".
    await supabase
      .from('users')
      .update({ password_hash: newHash, password_is_temp: false, temp_password_plain: null })
      .eq('id', payload.sub)
    return NextResponse.json({ ok: true })
  }

  // ─── Atualização de perfil ────────────────────────────────────────────────
  // Se apenas campos clinic* foram enviados, retorna ok sem atualizar perfil
  if (Object.keys(profileBody).length === 0) {
    return NextResponse.json({ ok: true })
  }

  const { name, phone, specialty, crmType, crmNumber, crmUf, minutesPerConsultation } = profileBody

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
