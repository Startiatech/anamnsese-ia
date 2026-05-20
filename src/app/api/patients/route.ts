import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/server/services/session'
import { PatientRepository } from '@/server/repositories/db'

export async function GET(req: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')
  const patients = q
    ? await PatientRepository.search(user.sub, q)
    : await PatientRepository.findAll(user.sub)

  return NextResponse.json(patients)
}

export async function POST(req: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  await PatientRepository.save(user.sub, body)
  return NextResponse.json(body, { status: 201 })
}
