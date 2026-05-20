import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/server/services/session'
import { UsageRepository } from '@/server/repositories/usage'

async function requireAdmin() {
  const payload = await getServerUser()
  if (!payload || (payload.role !== 'admin' && payload.role !== 'master')) return null
  return payload
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const result = await UsageRepository.getCostByUser(id)
  return NextResponse.json(result)
}
