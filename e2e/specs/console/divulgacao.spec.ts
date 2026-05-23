import { test, expect } from '@playwright/test'
import { loginAsMasterViaCookie } from '../../fixtures/session'

/**
 * Console / Acao "Disparar divulgação" (sidebar admin):
 *
 * Definida em `src/app/(admin)/console/admin-layout-client.tsx` como
 * `actionItem` da `AppSidebar` (renderizado por `src/components/layout/sidebar.tsx`
 * dentro de `SidebarMenuButton`). Apresenta-se como botao com label
 * "Disparar divulgação" e icone Megaphone, em gradient violet → cyan.
 *
 * Comportamento (handler inline no `admin-layout-client.tsx`):
 *  - onClick: window.open(`https://wa.me/?text=${encodeURIComponent(broadcastMessage)}`, '_blank')
 *  - Sem modal, sem form, sem chamada de API/server action, SEM disparo de emails.
 *  - Apenas abre uma nova aba do WhatsApp Web com a mensagem padrao pre-preenchida.
 *
 * Sem riscos de envio real — o teste se limita a:
 *  1. Confirmar que o botao esta visivel no sidebar admin (mobile: abre drawer)
 *  2. Confirmar que esta habilitado (`toBeEnabled`)
 *  3. Confirmar o gatilho de window.open via interceptacao do evento 'popup'
 *     (Playwright captura novas paginas abertas via window.open) e validar a
 *     URL gerada: host `wa.me`, query `text=` com o app URL embutido.
 *
 * Importante: nao navegamos para a aba aberta (wa.me eh externo). Apenas
 * inspecionamos a URL e fechamos a popup imediatamente.
 */
test.describe('console divulgacao (admin sidebar)', () => {
  test.setTimeout(90_000)

  async function openSidebarIfMobile(
    page: import('@playwright/test').Page,
    isMobile: boolean,
  ): Promise<void> {
    if (!isMobile) return
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

  test('botao "Disparar divulgação" esta visivel no sidebar admin', async ({ page, context }, testInfo) => {
    await loginAsMasterViaCookie(context)
    await page.goto('/console')
    await page.waitForLoadState('networkidle')

    await openSidebarIfMobile(page, testInfo.project.name === 'mobile')

    const broadcastBtn = page.getByRole('button', { name: /disparar divulgação/i }).first()
    await expect(broadcastBtn).toBeVisible({ timeout: 10_000 })
  })

  test('botao "Disparar divulgação" esta habilitado para o master', async ({ page, context }, testInfo) => {
    await loginAsMasterViaCookie(context)
    await page.goto('/console')
    await page.waitForLoadState('networkidle')

    await openSidebarIfMobile(page, testInfo.project.name === 'mobile')

    const broadcastBtn = page.getByRole('button', { name: /disparar divulgação/i }).first()
    await expect(broadcastBtn).toBeVisible({ timeout: 10_000 })
    await expect(broadcastBtn).toBeEnabled()
  })

  test('clique em "Disparar divulgação" abre nova aba do WhatsApp com mensagem pre-preenchida', async ({ page, context }, testInfo) => {
    await loginAsMasterViaCookie(context)

    // Stub window.open ANTES do goto: captura URL em variavel global em vez
    // de abrir aba real. Evita carregamento de wa.me externo (que falharia
    // ou ficaria pendente) e preserva a URL para validacao.
    await context.addInitScript(() => {
      ;(window as unknown as { __e2eOpenedUrl: string | null }).__e2eOpenedUrl = null
      const orig = window.open
      window.open = (url?: string | URL | null) => {
        ;(window as unknown as { __e2eOpenedUrl: string | null }).__e2eOpenedUrl =
          typeof url === 'string' ? url : (url?.toString() ?? null)
        return null
      }
      void orig
    })

    await page.goto('/console')
    await page.waitForLoadState('networkidle')

    await openSidebarIfMobile(page, testInfo.project.name === 'mobile')

    const broadcastBtn = page.getByRole('button', { name: /disparar divulgação/i }).first()
    await expect(broadcastBtn).toBeVisible({ timeout: 10_000 })
    await expect(broadcastBtn).toBeEnabled()
    await broadcastBtn.click()

    const openedUrl = await page.evaluate(
      () => (window as unknown as { __e2eOpenedUrl: string | null }).__e2eOpenedUrl,
    )
    expect(openedUrl).not.toBeNull()
    expect(openedUrl).toContain('wa.me')
    expect(openedUrl).toMatch(/[?&]text=/)
    const textParam = new URL(openedUrl as string).searchParams.get('text') ?? ''
    expect(textParam).toContain('Anamnese IA')
  })

  test('mensagem de divulgacao contem link do app e contato do responsavel', async ({ page, context }, testInfo) => {
    await loginAsMasterViaCookie(context)

    await context.addInitScript(() => {
      ;(window as unknown as { __e2eOpenedUrl: string | null }).__e2eOpenedUrl = null
      window.open = (url?: string | URL | null) => {
        ;(window as unknown as { __e2eOpenedUrl: string | null }).__e2eOpenedUrl =
          typeof url === 'string' ? url : (url?.toString() ?? null)
        return null
      }
    })

    await page.goto('/console')
    await page.waitForLoadState('networkidle')

    await openSidebarIfMobile(page, testInfo.project.name === 'mobile')

    const broadcastBtn = page.getByRole('button', { name: /disparar divulgação/i }).first()
    await expect(broadcastBtn).toBeEnabled()
    await broadcastBtn.click()

    const openedUrl = await page.evaluate(
      () => (window as unknown as { __e2eOpenedUrl: string | null }).__e2eOpenedUrl,
    )
    expect(openedUrl).not.toBeNull()
    const textParam = new URL(openedUrl as string).searchParams.get('text') ?? ''
    expect(textParam).toMatch(/https?:\/\//)
    expect(textParam).toContain('Leonardo Oliveira')
    expect(textParam).toContain('wa.me/5532999447711')
  })
})
