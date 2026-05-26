// src/proxy.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'

const PUBLIC_PATHS = ['/', '/login', '/request-access']
const ADMIN_PATHS = ['/console']
const ONBOARDING_PATH = '/app/settings'
const PLANS_PATH = '/app/plans'

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Rotas públicas — sem verificação
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  // Ignora assets, API routes de auth e submissão pública de solicitações
  if (
    pathname.startsWith('/_next') ||
    pathname === '/api/auth/login' ||
    pathname === '/api/auth/logout' ||
    pathname === '/api/auth/forgot-password' ||
    pathname === '/api/requests' ||
    pathname === '/api/stats' ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  const token = req.cookies.get(COOKIE_NAME)?.value
  const payload = token ? await verifyToken(token) : null

  if (!payload) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Rotas console — exige role admin ou master
  if (ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    if (payload.role !== 'admin' && payload.role !== 'master') {
      return NextResponse.redirect(new URL('/app/dashboard', req.url))
    }
  }

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-pathname', pathname)
  // Sinaliza se já está na rota de onboarding (evita loop no layout guard)
  requestHeaders.set('x-is-onboarding', pathname.startsWith(ONBOARDING_PATH) ? '1' : '0')
  requestHeaders.set('x-is-plans', pathname.startsWith(PLANS_PATH) ? '1' : '0')
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
