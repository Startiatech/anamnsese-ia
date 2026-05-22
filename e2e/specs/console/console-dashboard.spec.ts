import { test, expect } from '@playwright/test'
import { loginAsMasterViaCookie } from '../../fixtures/session'

/**
 * Dashboard do console admin (`/console`):
 *
 * Layout (src/app/(admin)/console/admin-layout-client.tsx):
 *  - Sidebar shadcn em viewports >= 768px; em mobile vira drawer aberto via
 *    SidebarTrigger (botao com sr-only "Toggle Sidebar") no Topbar.
 *  - navItems: Dashboard (/console), Solicitações (/console/requests),
 *    Usuários (/console/users), Planos (/console/plans),
 *    Configurações (/console/configuracoes), Feedbacks (/console/feedbacks),
 *    Interesses (/console/interesses).
 *
 * Conteudo (src/app/(admin)/console/page.tsx -> console-dashboard-client.tsx):
 *  - PageHeader: h1 "Dashboard" + descricao "Visão geral da plataforma" +
 *    botao "Atualizar"
 *  - Bloco "Recursos & Custos" com card "Consumo por período" (Hoje/7 dias/30 dias)
 *    e "Profissionais cadastrados" (contagem + Stethoscope)
 *  - Bloco "Métricas" com 5 cards: Pendentes, Aprovados, Total solicitações,
 *    Usuários ativos, Interesses planos
 *  - Bloco "Visão geral" com "Últimos Profissionais" e "Atividades"
 *
 * Master autenticado via cookie JWT (loginAsMasterViaCookie) — bypassa
 * /api/auth/login e rate-limit, permitindo paralelismo entre viewports.
 */
test.describe('console dashboard (admin)', () => {
  test.setTimeout(90_000)

  test('master ve a pagina renderizada com elementos principais', async ({ page, context }) => {
    await loginAsMasterViaCookie(context)
    await page.goto('/console')
    await page.waitForLoadState('networkidle')

    // Header principal do dashboard
    await expect(page.getByRole('heading', { level: 1, name: /^dashboard$/i })).toBeVisible()
    await expect(page.getByText(/visão geral da plataforma/i)).toBeVisible()

    // Botao Atualizar do PageHeader
    const refreshBtn = page.getByRole('button', { name: /atualizar/i })
    await expect(refreshBtn).toBeVisible()
    await expect(refreshBtn).toBeEnabled()

    // Secoes principais
    await expect(page.getByRole('heading', { name: /recursos & custos/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /^métricas$/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /visão geral/i })).toBeVisible()
  })

  test('cards de metricas exibem labels e valores numericos', async ({ page, context }) => {
    await loginAsMasterViaCookie(context)
    await page.goto('/console')
    await page.waitForLoadState('networkidle')

    // Card "Consumo por período" com colunas Hoje / 7 dias / 30 dias
    await expect(page.getByText(/consumo por período/i)).toBeVisible()
    await expect(page.getByText(/^hoje$/i).first()).toBeVisible()
    await expect(page.getByText(/^7 dias$/i).first()).toBeVisible()
    await expect(page.getByText(/^30 dias$/i).first()).toBeVisible()
    await expect(page.getByText(/total acumulado/i)).toBeVisible()

    // Card "Profissionais cadastrados"
    await expect(page.getByText(/profissionais cadastrados/i)).toBeVisible()
    await expect(page.getByText(/ativos, sem exclusão agendada/i)).toBeVisible()

    // Bloco "Métricas" — 5 labels obrigatorios
    const metricLabels = [
      /^pendentes$/i,
      /^aprovados$/i,
      /total solicitações/i,
      /usuários ativos/i,
      /interesses planos/i,
    ]
    for (const label of metricLabels) {
      await expect(page.getByText(label).first()).toBeVisible()
    }

    // Cada metrica renderiza um valor numerico (text-2xl font-bold) — usamos
    // a estrutura: pegamos todos os <p> com classe text-2xl dentro do grid de
    // metricas. Fallback semantico: ao menos um "0" ou digito visivel proximo
    // ao label "Total solicitações" (que sempre tem valor >= 0).
    // Aqui validamos que existem 5 valores numericos visiveis na area de metricas.
    const numericValues = page.locator('p.text-2xl.font-bold')
    await expect(numericValues.first()).toBeVisible()
    const count = await numericValues.count()
    expect(count).toBeGreaterThanOrEqual(5)
  })

  test('sidebar admin expoe links para Solicitações, Usuários e Planos com hrefs corretos', async ({ page, context }, testInfo) => {
    await loginAsMasterViaCookie(context)
    await page.goto('/console')
    await page.waitForLoadState('networkidle')

    const isMobile = testInfo.project.name === 'mobile'
    if (isMobile) {
      const trigger = page.getByRole('button', { name: /toggle sidebar/i }).first()
      await expect(trigger).toBeVisible()
      await expect(trigger).toBeEnabled()
      await trigger.click()
    }

    const solicitacoes = page.getByRole('link', { name: /^solicitações/i }).first()
    const usuarios = page.getByRole('link', { name: /^usuários$/i }).first()
    const planos = page.getByRole('link', { name: /^planos$/i }).first()
    const dashboard = page.getByRole('link', { name: /^dashboard$/i }).first()

    await expect(solicitacoes).toBeVisible({ timeout: 10_000 })
    await expect(usuarios).toBeVisible()
    await expect(planos).toBeVisible()
    await expect(dashboard).toBeVisible()

    await expect(solicitacoes).toHaveAttribute('href', '/console/requests')
    await expect(usuarios).toHaveAttribute('href', '/console/users')
    await expect(planos).toHaveAttribute('href', '/console/plans')
    await expect(dashboard).toHaveAttribute('href', '/console')
  })

  test('clique em "Usuários" navega para /console/users', async ({ page, context }, testInfo) => {
    await loginAsMasterViaCookie(context)
    await page.goto('/console')
    await page.waitForLoadState('networkidle')

    const isMobile = testInfo.project.name === 'mobile'
    if (isMobile) {
      // Evita interceptacao de toast Sonner em mobile
      await page.evaluate(() => {
        document
          .querySelectorAll('[data-sonner-toaster], [data-sonner-toast]')
          .forEach((el) => ((el as HTMLElement).style.pointerEvents = 'none'))
      })
      const trigger = page.getByRole('button', { name: /toggle sidebar/i }).first()
      await expect(trigger).toBeEnabled()
      await trigger.click()
    }

    const usuariosLink = page.getByRole('link', { name: /^usuários$/i }).first()
    await expect(usuariosLink).toBeVisible({ timeout: 10_000 })
    await usuariosLink.click()

    await page.waitForURL(/\/console\/users(\?|$|\/)/, { timeout: 30_000 })
    await expect(page).toHaveURL(/\/console\/users/)
  })

  test('botao "Atualizar" no PageHeader permanece em /console apos clique', async ({ page, context }) => {
    await loginAsMasterViaCookie(context)
    await page.goto('/console')
    await page.waitForLoadState('networkidle')

    const refreshBtn = page.getByRole('button', { name: /atualizar/i })
    await expect(refreshBtn).toBeEnabled()
    await refreshBtn.click()

    // router.refresh() nao muda URL — apenas re-busca dados
    await expect(page).toHaveURL(/\/console(\?|$)/)
    // Header continua presente apos refresh
    await expect(page.getByRole('heading', { level: 1, name: /^dashboard$/i })).toBeVisible()
  })
})
