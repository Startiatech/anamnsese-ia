import { SignJWT } from 'jose'
import type { BrowserContext } from '@playwright/test'
import { getTestSupabase } from './supabase'

const COOKIE_NAME = 'anamnese_auth'
const TOKEN_EXPIRY = '7d'

interface JwtPayload {
  sub: string
  email: string
  name: string
  role: 'user' | 'admin' | 'master'
  planId?: string | null
  specialty?: string | null
  crmType?: string | null
  crmNumber?: string | null
  crmUf?: string | null
  hasPin?: boolean
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('[e2e] JWT_SECRET ausente — carregar .env.local antes de assinar')
  }
  return new TextEncoder().encode(secret)
}

async function signSessionToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(getJwtSecret())
}

/**
 * Login programatico: gera JWT e seta cookie diretamente no contexto do browser.
 * Bypassa /api/auth/login (evita rate-limit) e a UI de login.
 *
 * Usar quando o teste nao quer validar a UI de login — apenas precisa de uma
 * sessao autenticada para testar outras telas.
 */
export async function setSessionCookie(
  context: BrowserContext,
  user: {
    id: string
    email: string
    name: string
    role: 'user' | 'admin' | 'master'
    planId?: string | null
  },
  baseUrl = 'http://localhost:3000',
): Promise<void> {
  const token = await signSessionToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    planId: user.planId ?? null,
    specialty: null,
    crmType: null,
    crmNumber: null,
    crmUf: null,
    hasPin: false,
  })

  const url = new URL(baseUrl)
  await context.addCookies([
    {
      name: COOKIE_NAME,
      value: token,
      domain: url.hostname,
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
      expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    },
  ])
}

/**
 * Login programatico do master fixo (`projectanamneseai2026@gmail.com`).
 * Busca o registro real no banco de teste para garantir id correto e seta cookie.
 */
export async function loginAsMasterViaCookie(context: BrowserContext): Promise<{
  id: string
  email: string
  name: string
}> {
  const supabase = getTestSupabase()
  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, role, plan_id')
    .eq('email', 'projectanamneseai2026@gmail.com')
    .single()
  if (error || !data) {
    throw new Error(`[e2e] master nao encontrado no banco de teste: ${error?.message}`)
  }
  await setSessionCookie(context, {
    id: data.id,
    email: data.email,
    name: data.name,
    role: data.role as 'master',
    planId: data.plan_id,
  })
  return { id: data.id, email: data.email, name: data.name }
}
