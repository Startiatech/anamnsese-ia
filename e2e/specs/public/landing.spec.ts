import { test, expect } from '@playwright/test'

/**
 * Landing page (`/`) — composta por:
 *  - LandingNavbar       : Logo, "Planos" (#planos), "Solicitar acesso" (/login?mode=solicitar, hidden < sm), "Entrar" (/login)
 *  - HeroSection         : h1 "Anamnese clínica / gerada por IA", CTAs "Ver planos" (#planos) e "Já tenho acesso" (/login)
 *  - CTASection          : link "Solicitar acesso gratuito" -> /login?mode=solicitar (visível em todos os viewports)
 *  - LandingFooter       : <footer> semântico com copyright e ícones de LinkedIn/WhatsApp
 */
test.describe('landing page', () => {
  test('exibe hero com headline, CTA "Ver planos" e CTA "Já tenho acesso"', async ({ page }) => {
    await page.goto('/')

    // Headline principal — texto quebrado em spans, mas "Anamnese clínica" é estável
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toBeVisible()
    await expect(heading).toContainText(/Anamnese clínica/i)
    await expect(heading).toContainText(/gerada por IA/i)

    // CTA primário do hero
    await expect(page.getByRole('link', { name: /ver planos/i })).toBeVisible()

    // CTA secundário do hero ("Já tenho acesso" aparece em hero e em cta-section — basta visibilidade)
    await expect(page.getByRole('link', { name: /já tenho acesso/i }).first()).toBeVisible()
  })

  test('navbar exibe botão "Entrar" e leva para /login', async ({ page }) => {
    await page.goto('/')

    const entrar = page.getByRole('link', { name: /entrar/i })
    await expect(entrar).toBeVisible()
    await entrar.click()
    await page.waitForURL(/\/login(\?|$|#)/)
    await expect(page).toHaveURL(/\/login/)
  })

  test('CTA "Solicitar acesso gratuito" navega para /login?mode=solicitar', async ({ page }) => {
    await page.goto('/')

    // CTASection — link sempre visível (não escondido por breakpoint)
    const solicitar = page.getByRole('link', { name: /solicitar acesso gratuito/i })
    await expect(solicitar).toBeVisible()
    await solicitar.click()
    await page.waitForURL(/\/login\?.*mode=solicitar/)
    await expect(page).toHaveURL(/mode=solicitar/)
  })

  test('renderiza footer com copyright', async ({ page }) => {
    await page.goto('/')

    const footer = page.locator('footer')
    await expect(footer).toBeVisible()
    await expect(footer).toContainText(/Anamnese IA/i)
    await expect(footer).toContainText(/2026/)
  })
})
