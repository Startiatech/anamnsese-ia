import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { supabase } from '@/server/supabase'

/**
 * Retorna a senha temporaria ja persistida (texto plano) de uma solicitacao
 * aprovada. NAO regera. Disponivel apenas enquanto password_is_temp=true —
 * apos o usuario trocar a senha, /api/users/me limpa temp_password_plain.
 *
 * Caso de uso: master fechou o WhatsApp sem enviar e precisa recuperar as
 * credenciais originais para reenviar.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  const payload = token ? await verifyToken(token) : null

  if (!payload || (payload.role !== 'admin' && payload.role !== 'master')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await ctx.params

  const { data: request, error: reqError } = await supabase
    .from('access_requests')
    .select('id, name, email, phone, status')
    .eq('id', id)
    .single()

  if (reqError || !request) {
    return NextResponse.json({ error: 'Solicitação não encontrada' }, { status: 404 })
  }

  if (request.status !== 'approved') {
    return NextResponse.json(
      { error: 'Solicitação não está aprovada' },
      { status: 400 },
    )
  }

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('password_is_temp, temp_password_plain')
    .eq('email', request.email)
    .single()

  if (userError || !user) {
    return NextResponse.json({ error: 'Usuário associado não encontrado' }, { status: 404 })
  }

  if (!user.password_is_temp || !user.temp_password_plain) {
    return NextResponse.json(
      { error: 'Usuário já trocou a senha — credenciais não disponíveis' },
      { status: 410 },
    )
  }

  return NextResponse.json({
    ok: true,
    password: user.temp_password_plain,
    name: request.name,
    email: request.email,
    phone: request.phone,
  })
}
