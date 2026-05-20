import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { CreditRepository } from '@/lib/credits'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  const payload = token ? await verifyToken(token) : null

  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const limited = await checkRateLimit(`credit-refund:${payload.sub}`)
  if (limited) {
    return NextResponse.json({ error: 'Muitas tentativas.' }, { status: 429 })
  }

  const current = await CreditRepository.getCredits(payload.sub)
  await CreditRepository.setCredits(payload.sub, current + 1)
  return NextResponse.json({ ok: true })
}
