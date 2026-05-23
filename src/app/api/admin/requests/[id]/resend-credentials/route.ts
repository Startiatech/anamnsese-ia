import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, hashPassword, COOKIE_NAME } from '@/lib/auth'
import { supabase } from '@/server/supabase'

/**
 * Gera nova senha temporaria para o usuario associado a uma solicitacao
 * de acesso ja aprovada. Usado quando o fluxo de aprovacao precisou ser
 * refeito — ex: master fechou aba do WhatsApp antes do envio.
 *
 * Retorna a senha em texto plano UMA VEZ + dados de contato para que o
 * client possa exibir o modal de credenciais e abrir o WhatsApp.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  const payload = token ? await verifyToken(token) : null

  if (!payload || (payload.role !== 'admin' && payload.role !== 'master')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await ctx.params

  // 1) Carrega a solicitacao
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
      { error: 'Solicitação não está aprovada — não há credenciais a reenviar' },
      { status: 400 },
    )
  }

  // 2) Carrega o usuario criado a partir dessa solicitacao
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('email', request.email)
    .single()

  if (userError || !user) {
    return NextResponse.json(
      { error: 'Usuário associado não encontrado' },
      { status: 404 },
    )
  }

  // 3) Gera nova senha alfanumerica de 8 caracteres
  const newPassword = Array.from({ length: 8 }, () =>
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.charAt(
      Math.floor(Math.random() * 62),
    ),
  ).join('')

  const passwordHash = await hashPassword(newPassword)

  const { error: updateError } = await supabase
    .from('users')
    .update({ password_hash: passwordHash, password_is_temp: true })
    .eq('id', user.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    password: newPassword,
    name: request.name,
    email: request.email,
    phone: request.phone,
  })
}
