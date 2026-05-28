import { test, expect } from '@playwright/test'
import { createTestUser, loginAsUser } from '../../fixtures/auth'

/**
 * Dashboard do usuario (`/dashboard`):
 *
 * Layout (src/app/(app)/app-layout-client.tsx):
 *  - Sidebar shadcn fixa em viewports >= 768px (tablet/laptop/desktop)
 *  - Em viewports < 768px (mobile) a sidebar vira um Sheet, oculto por padrao,
 *    aberto via SidebarTrigger no Topbar (botao com sr-only "Toggle Sidebar")
 *  - NAV_ITEMS: Dashboard, Atendimento, Historico, Planos
 *
 * Conteudo do dashboard (src/app/(app)/dashboard/page.tsx):
 *  - GreetingSection: "Bom dia/Boa tarde/Boa noite, {firstName}!" — para usuarios
 *    e2e o nome comeca com "E2E", entao saudacao contem "E2E"
 *  - SidebarCredits (sidebar desktop): "999 créditos" — para usuarios criados
 *    via createTestUser (credits_remaining: 999)
 *  - CreditsChip (topbar mobile): icone Zap + "999"
 *  - Botao CTA: "Novo atendimento" (link para /consultation)
 *
 * Logout (Topbar AvatarMenu):
 *  - Avatar trigger -> "Sair" no dropdown -> modal de confirmacao -> botao "Sair"
 *
 * Login do usuario nao usa master (rate-limit por email+IP) — cada teste cria
 * seu proprio usuario com createTestUser({ role: 'user' }).
 */
test.describe('dashboard do usuario', () => {
  // Test timeout maior para acomodar compilacao on-demand do Next dev em
  // paralelo nos 4 viewports.
  test.setTimeout(90_000)

  test('exibe saudacao com nome do usuario e creditos', async ({ page }, testInfo) => {
    const user = await createTestUser({ role: 'user' })
    await loginAsUser(page, user)
    await page.waitForURL(/\/app\/dashboard(\?|$|\/)/, { timeout: 60_000 })
    await page.waitForLoadState('networkidle')

    // Saudacao contem primeiro nome ("E2E" para usuarios e2e)
    await expect(
      page.getByRole('heading', { name: /(bom dia|boa tarde|boa noite),\s*E2E/i }),
    ).toBeVisible()

    // CTA principal sempre presente
    await expect(page.getByRole('link', { name: /novo atendimento/i })).toBeVisible()

    // Creditos: em mobile aparece no Topbar (CreditsChip), em viewports
    // >= 768px aparece na sidebar (SidebarCredits: "999 créditos")
    const isMobile = testInfo.project.name === 'mobile'
    if (isMobile) {
      // CreditsChip mostra apenas o numero "999"
      await expect(page.getByText('999').first()).toBeVisible()
    } else {
      await expect(page.getByText(/999\s*créditos/i)).toBeVisible()
    }
  })

  test('navegacao expoe link "Atendimento" (sidebar desktop ou drawer mobile)', async ({ page }, testInfo) => {
    const user = await createTestUser({ role: 'user' })
    await loginAsUser(page, user)
    await page.waitForURL(/\/app\/dashboard(\?|$|\/)/, { timeout: 60_000 })
    await page.waitForLoadState('networkidle')

    const isMobile = testInfo.project.name === 'mobile'

    if (isMobile) {
      // Sidebar fica oculta — abrir via SidebarTrigger no Topbar (sr-only "Toggle Sidebar")
      const trigger = page.getByRole('button', { name: /toggle sidebar/i }).first()
      await expect(trigger).toBeVisible()
      await expect(trigger).toBeEnabled()
      await trigger.click()
    }

    // Link de Atendimento visivel apos abertura (mobile) ou diretamente (>=768)
    const atendimentoLink = page.getByRole('link', { name: /^atendimento$/i }).first()
    await expect(atendimentoLink).toBeVisible({ timeout: 10_000 })
    await expect(atendimentoLink).toHaveAttribute('href', '/app/consultation')

    // Outros itens de navegacao tambem devem estar acessiveis
    await expect(page.getByRole('link', { name: /^histórico$/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /^planos$/i }).first()).toBeVisible()
  })

  test('logout via topbar redireciona para /login', async ({ page }, testInfo) => {
    // No mobile o nome do usuario fica oculto no avatar (hidden sm:flex) mas
    // o avatar ainda eh clicavel — mantemos teste em todos os viewports.
    const user = await createTestUser({ role: 'user' })
    await loginAsUser(page, user)
    await page.waitForURL(/\/app\/dashboard(\?|$|\/)/, { timeout: 60_000 })
    await page.waitForLoadState('networkidle')

    // Abre o dropdown do avatar — o trigger eh o unico botao com fallback
    // de initials. Usamos um locator mais semantico: o botao que contem o
    // texto das initials (deriveInitials gera 2 chars). Fallback: ultimo
    // botao do header.
    // O avatar trigger nao tem aria-label proprio; clicamos pelo Avatar via
    // role=button dentro do header.
    const initials = user.email.slice(0, 1).toUpperCase() // initials reais vem do name "E2E xxx" -> "E"
    void initials
    // Estrategia robusta: localizar pelo texto "Sair" so aparece dentro do
    // DropdownMenu apos abrir. Entao abrimos via o ChevronDown/Avatar — que
    // eh o ultimo botao no header da topbar.
    const header = page.locator('header').first()
    // O AvatarMenu trigger eh o unico <button> com Avatar dentro do header.
    // Selecionamos pelo conteudo do avatar: usa AvatarFallback com initials.
    // Como recurso semantico, pegamos qualquer botao do header que contenha
    // o ChevronDown via :has, mas para evitar CSS fragil usamos o ultimo
    // botao do header (sempre o avatar nessa UI).
    const avatarTrigger = header.getByRole('button').last()
    await expect(avatarTrigger).toBeEnabled()
    await avatarTrigger.click()

    // Item "Sair" no dropdown
    const sairItem = page.getByRole('menuitem', { name: /^sair$/i })
    await expect(sairItem).toBeVisible({ timeout: 5_000 })
    await sairItem.click()

    // Modal de confirmacao — botao "Sair" vermelho
    const confirmSair = page.getByRole('button', { name: /^sair$/i })
    await expect(confirmSair).toBeVisible({ timeout: 5_000 })
    await confirmSair.click()

    // Redirect para /login apos logout
    await page.waitForURL(/\/login(\?|$|\/)/, { timeout: 30_000 })
    await expect(page).toHaveURL(/\/login/)

    void testInfo
  })

  test('mobile: dashboard sem scroll horizontal em 375px', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'cenario especifico do viewport mobile')

    const user = await createTestUser({ role: 'user' })
    await loginAsUser(page, user)
    await page.waitForURL(/\/app\/dashboard(\?|$|\/)/, { timeout: 60_000 })
    await page.waitForLoadState('networkidle')

    // Topbar do user (logo + creditos + sino + toggle + avatar) deve caber em 375px
    // apos o fix de responsividade da topbar (sub-pixel tolerante).
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })
})
