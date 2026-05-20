import { NextResponse } from 'next/server'
import { addRequest, listRequests, findRequestByEmail } from '@/lib/requests'
import { checkDuplicateRequest } from '@/lib/request-policy'
import { findUserByEmail } from '@/server/repositories/users'
import type { AccessRequest } from '@/lib/types'

export async function GET(req: Request) {
  const email = new URL(req.url).searchParams.get('email')
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
