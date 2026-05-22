// Achados de inspecao da pagina de login (src/app/(auth)/login/):
// - URL da rota de login: /login
// - Labels reais dos inputs:
//     * "Email" (label htmlFor="email", input id="email")
//     * "Senha" (label htmlFor="password", input id="password")
//   Casa com regex /email/i e /senha/i
// - Texto do botao de submit: "Entrar" (estado normal) / "Aguarde..." (durante submit)
//   Casa com regex /entrar/i (estado normal)
// - Redirect pos-login (src/app/api/auth/login/route.ts):
//     * role=user  -> /dashboard
//     * role=admin -> /console
//     * role=master -> /console
//   O client usa window.location.href = `${redirectTo}?login=1` apos sucesso.

import type { Page } from '@playwright/test'
import bcrypt from 'bcryptjs'
import { getTestSupabase } from './supabase'

export const E2E_DEFAULT_PASSWORD = 'E2eTest!2026'
export const MASTER_EMAIL = 'projectanamneseai2026@gmail.com'
export const MASTER_PASSWORD = 'anamnese-ia-claude-code@adm-master'

export interface E2eUser {
  id: string
  email: string
  password: string
  role: 'user' | 'admin' | 'master'
}

export function makeE2eId(prefix = 'e2e'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export async function createTestUser(opts?: {
  role?: 'user' | 'admin' | 'master'
  planId?: string | null
  onboarded?: boolean
}): Promise<E2eUser> {
  const role = opts?.role ?? 'user'
  const planId = opts?.planId === undefined ? null : opts.planId
  const onboarded = opts?.onboarded ?? true

  const uniqueId = makeE2eId()
  const email = `${uniqueId}@test.com`
  const passwordHash = await bcrypt.hash(E2E_DEFAULT_PASSWORD, 12)

  const supabase = getTestSupabase()
  const { data, error } = await supabase
    .from('users')
    .insert({
      name: `E2E ${uniqueId}`,
      email,
      password_hash: passwordHash,
      role,
      plan_id: planId,
      plan_selected: true,
      onboarding_completed: onboarded,
      password_is_temp: false,
      credits_remaining: 999,
      blocked: false,
    })
    .select('id, email, role')
    .single()

  if (error || !data) {
    throw new Error(`[e2e] createTestUser falhou: ${error?.message}`)
  }

  return { id: data.id, email: data.email, password: E2E_DEFAULT_PASSWORD, role: data.role as E2eUser['role'] }
}

export async function loginViaUI(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/senha/i).fill(password)
  await page.getByRole('button', { name: /entrar/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 10_000 })
}

export async function loginAsMaster(page: Page): Promise<void> {
  await loginViaUI(page, MASTER_EMAIL, MASTER_PASSWORD)
}

export async function loginAsUser(page: Page, user: E2eUser): Promise<void> {
  await loginViaUI(page, user.email, user.password)
}
