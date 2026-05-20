import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { listUsers } from '@/lib/users'

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  const payload = token ? await verifyToken(token) : null

  if (!payload || (payload.role !== 'admin' && payload.role !== 'master')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const users = (await listUsers()).map(({ id, name, email, specialty, role, createdAt }) => ({
    id, name, email, specialty, role, createdAt,
  }))

  return NextResponse.json({ users })
}
