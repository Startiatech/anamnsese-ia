import { NextResponse } from 'next/server'
import { COOKIE_NAME } from '@/lib/auth'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(COOKIE_NAME)
  return response
}

// Usado quando o usuário é deletado do banco mas ainda tem JWT válido
export async function GET(req: Request) {
  const url = new URL(req.url)
  const response = NextResponse.redirect(new URL('/login', url.origin))
  response.cookies.delete(COOKIE_NAME)
  return response
}
