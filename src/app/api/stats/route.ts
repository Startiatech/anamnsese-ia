import { countRegisteredUsers } from '@/server/repositories/users'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const count = await countRegisteredUsers()
    return NextResponse.json({ count })
  } catch {
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
