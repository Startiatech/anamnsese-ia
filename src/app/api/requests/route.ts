import { NextResponse } from 'next/server'
import { getServerUser } from '@/server/services/session'
import { addRequest, listRequests, findRequestByEmail } from '@/lib/requests'
import { checkDuplicateRequest } from '@/lib/request-policy'
import { findUserByEmail } from '@/server/repositories/users'
import type { AccessRequest } from '@/lib/types'

export async function GET(req: Request) {
  const email = new URL(req.url).searchParams.get('email')

  // Lookup por email: público — usado pelo formulário de solicitação para
  // detectar duplicidade antes de enviar. Não vaza a lista completa.
  if (email) {
    const existing = await findRequestByEmail(email)
    let userExists = true
    if (existing?.status === 'approved') {
      const user = await findUserByEmail(email)
      userExists = !!user
    }
    const duplicate = checkDuplicateRequest(existing, userExists)
    return NextResponse.json({ duplicate, request: existing ?? null })
  }

  // Listar todas as solicitações expõe PII (nome, email, telefone, mensagem)
  // de todos os solicitantes — restrito a admin/master.
  const session = await getServerUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin' && session.role !== 'master') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ requests: await listRequests() })
}

export async function POST(req: Request) {
  const body = await req.json()
  const { name, email, specialty, phone, message } = body

  if (!name || !email || !specialty || !phone) {
    return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
  }

  const existing = await findRequestByEmail(email)
  let userExists = true
  if (existing?.status === 'approved') {
    const user = await findUserByEmail(email)
    userExists = !!user
  }
  const duplicate = checkDuplicateRequest(existing, userExists)
  if (duplicate?.block) {
    return NextResponse.json({ error: 'duplicate', status: duplicate.status }, { status: 409 })
  }

  const request: AccessRequest = {
    id: crypto.randomUUID(),
    name,
    email,
    specialty,
    phone,
    message: message ?? '',
    createdAt: new Date().toISOString(),
    status: 'pending',
  }

  await addRequest(request)
  return NextResponse.json({ request }, { status: 201 })
}
