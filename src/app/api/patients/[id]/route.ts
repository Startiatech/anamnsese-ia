import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/server/services/session'
import { PatientRepository } from '@/server/repositories/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const patient = await PatientRepository.findById(user.sub, id)
  if (!patient) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(patient)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  await PatientRepository.update(user.sub, id, body)
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await PatientRepository.delete(user.sub, id)
  return NextResponse.json({ ok: true })
}
