import { test, expect } from '@playwright/test'
import {
  MASTER_EMAIL,
  MASTER_PASSWORD,
  createTestUser,
  E2E_DEFAULT_PASSWORD,
} from '../../fixtures/auth'

/**
 * Pagina de login (`/login`):
 *  - Labels reais: "Email" (id=email) e "Senha" (id=password) -> getByLabel(/email/i) | getByLabel(/senha/i)
 *  - Botao submit: "Entrar" (durante submit vira "Aguarde...") -> getByRole('button', { name: /entrar/i })
 *  - Redirect pos-login (src/app/api/auth/login/route.ts):
 *      role=user            -> /dashboard
 *      role=admin | master  -> /console
 *  - Erros API (mostrados via toast Sonner):
 *      credenciais invalidas -> "Email ou senha incorretos" (status 401)
 *      payload vazio         -> "Email e senha são obrigatórios" (status 400)
 *  - Erros Zod inline (src/lib/schemas.ts loginSchema), modo onTouched:
 *      email invalido        -> "Email inválido"
 *      email vazio           -> "Email é obrigatório"
 *      senha vazia           -> "Senha é obrigatória"
 *
 * Sonner renderiza toasts em region [aria-label="Notifications"]; assertamos
 * por texto que e suficientemente unico ("Email ou senha incorretos").
 */
test.describe('login', () => {
  // Test timeout maior para evitar cap em 30s (default) durante compilacao
  // on-demand do Next dev em paralelo nos 4 viewports.
  test.setTimeout(90_000)

  test('master loga com sucesso e e redirecionado para /console', async ({ page }, testInfo) => {
    // Login do master roda em apenas 1 viewport: rate-limit da API
    // `/api/auth/login` usa chave `login:${ip}:${email}` (src/lib/rate-limit.ts).
    // 4 logins paralelos com mesmo email+IP estouram o limite (HTTP 429).
    // UI de login eh identica em todos viewports — testar 1x cobre o caso.
    test.skip(testInfo.project.name !== 'desktop', 'evita rate-limit paralelo do master')

    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Aguarda o form estar interativo antes de preencher (React hidratado)
    const submitBtn = page.getByRole('button', { name: /entrar/i })
    await expect(submitBtn).toBeEnabled()

    await page.getByLabel(/email/i).fill(MASTER_EMAIL)
    await page.getByLabel(/senha/i).fill(MASTER_PASSWORD)

    // Captura a resposta da API em paralelo ao click — garante que o submit
    // realmente disparou mesmo sob carga do dev server.
    const loginResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/auth/login') && resp.request().method() === 'POST',
      { timeout: 30_000 },
    )
    await submitBtn.click()
    const response = await loginResponse
    expect(response.status()).toBe(200)

    await page.waitForURL(/\/console(\?|$|\/)/, { timeout: 30_000 })
    await expect(page).toHaveURL(/\/console/)
  })

  test('usuario profissional loga e e redirecionado para /app/dashboard', async ({ page }) => {
    const user = await createTestUser({ role: 'user' })
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(user.email)
    await page.getByLabel(/senha/i).fill(E2E_DEFAULT_PASSWORD)
    await page.getByRole('button', { name: /entrar/i }).click()

    await page.waitForURL(/\/app\/dashboard(\?|$|\/)/, { timeout: 60_000 })
    await expect(page).toHaveURL(/\/app\/dashboard/)
  })

  test('credencial invalida exibe toast "Email ou senha incorretos" e mantem em /login', async ({ page }, testInfo) => {
    // Usa email unico por viewport para evitar rate-limit compartilhado
    // (chave eh `login:${ip}:${email}` — emails distintos = limites independentes).
    const email = `e2e-credencial-${testInfo.project.name}-${Date.now()}@test.com`
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/senha/i).fill('senha-errada-e2e-123')
    await page.getByRole('button', { name: /entrar/i }).click()

    // Sonner renderiza o texto em 2 nos (toast visivel + aria-live invisivel).
    // Usamos .first() para pegar o primeiro match e evitar strict mode.
    await expect(page.getByText('Email ou senha incorretos').first()).toBeVisible({
      timeout: 15_000,
    })
    await expect(page).toHaveURL(/\/login/)
  })

  test('email inexistente exibe toast "Email ou senha incorretos"', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(`e2e-inexistente-${Date.now()}@test.com`)
    await page.getByLabel(/senha/i).fill('qualquerCoisa123')
    await page.getByRole('button', { name: /entrar/i }).click()

    await expect(page.getByText('Email ou senha incorretos').first()).toBeVisible({
      timeout: 15_000,
    })
    await expect(page).toHaveURL(/\/login/)
  })

  test('validacao Zod bloqueia email invalido (mensagem inline)', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/email/i).fill('nao-e-email')
    await page.getByLabel(/senha/i).fill('qualquerSenha123')
    await page.getByRole('button', { name: /entrar/i }).click()

    await expect(page.getByText('Email inválido')).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test('campos vazios disparam validacoes "Email é obrigatório" e "Senha é obrigatória"', async ({ page }) => {
    await page.goto('/login')
    // Touch + blur ambos os campos para acionar mode: 'onTouched' antes do submit
    await page.getByLabel(/email/i).click()
    await page.getByLabel(/senha/i).click()
    await page.getByRole('button', { name: /entrar/i }).click()

    await expect(page.getByText('Email é obrigatório')).toBeVisible()
    await expect(page.getByText('Senha é obrigatória')).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })
})
