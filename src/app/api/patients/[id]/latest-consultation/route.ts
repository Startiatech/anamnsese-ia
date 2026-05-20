import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/server/services/session'
import { ConsultationRepository } from '@/server/repositories/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const consultation = await ConsultationRepository.findLatestByPatientId(user.sub, id)
  if (!consultation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(consultation)
}
