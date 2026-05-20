import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/server/services/session'
import { ConsultationRepository } from '@/server/repositories/db'

export async function GET(req: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const limit = Math.min(Number(searchParams.get('limit') ?? 20), 100)
  const offset = Math.max(Number(searchParams.get('offset') ?? 0), 0)

  const consultations = await ConsultationRepository.findAll(user.sub, { limit, offset })
  return NextResponse.json(consultations)
}

export async function POST(req: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id } = await ConsultationRepository.save(user.sub, body)
  return NextResponse.json({ ok: true, id }, { status: 201 })
}
