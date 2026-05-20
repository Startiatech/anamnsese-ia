import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { CreditRepository } from '@/lib/credits'

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  const payload = token ? await verifyToken(token) : null

  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const credits = await CreditRepository.getCredits(payload.sub)

  return NextResponse.json({
    id: payload.sub,
    name: payload.name,
    email: payload.email,
    role: payload.role,
    credits,
  })
}
