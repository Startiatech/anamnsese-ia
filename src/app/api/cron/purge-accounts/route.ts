import { NextRequest, NextResponse } from 'next/server'
import { findUsersScheduledForDeletion, deleteUser } from '@/server/repositories/users'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const expected = `Bearer ${process.env.CRON_SECRET}`

  if (!auth || auth !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const users = await findUsersScheduledForDeletion()
    await Promise.all(users.map((u) => deleteUser(u.id)))
    return NextResponse.json({ purged: users.length })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
