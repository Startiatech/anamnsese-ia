import { test, expect, type Page } from '@playwright/test'
import { loginAsMasterViaCookie } from '../../fixtures/session'
import { getTestSupabase } from '../../fixtures/supabase'

/**
 * Console / Interesses (`/console/interesses`):
 *
 * Page server (src/app/(admin)/console/interesses/page.tsx) chama
 * `PlanInterestRepository.list()` e renderiza `InteressesClient`.
 *
 * Client (src/app/(admin)/console/interesses/interesses-client.tsx):
 *  - PageHeader "Interesses em planos"
 *  - Filtros: Todos | Profissional | Gestao & Clinicas — com contador
 *  - Tabela com colunas: Nome | Email | Plano | Data
 *  - Estado vazio (apos filtro): Empty "Nenhum interesse registrado"
 *
 * Tabela `plan_interest` (campos: id, name, email, plan, created_at).
 * Planos validos: 'profissional' | 'gestao-clinicas'.
 *
 * Isolamento: emails com prefixo `e2e-` (cleanup global limpa por LIKE
 * 'e2e-%@test.com'). Tambem deletamos por id no finally para nao poluir
 * outros testes da mesma run.
 */

type PlanValue = 'profissional' | 'gestao-clinicas'

interface SeededInterest {
  id: string
  name: string
  email: string
  plan: PlanValue
}

async function seedInterest(opts: { plan: PlanValue; tag?: string }): Promise<SeededInterest> {
  const tag = opts.tag ?? Math.random().toString(36).slice(2, 8)
  const email = `e2e-interesse-${tag}-${Date.now()}@test.com`
  const name = `E2E Interesse ${tag}`
  const supabase = getTestSupabase()
  const { data, error } = await supabase
    .from('plan_interest')
    .insert({
      name,
      email,
      plan: opts.plan,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error || !data) {
    throw new Error(`[e2e] seedInterest falhou: ${error?.message}`)
  }
  return { id: (data as { id: string }).id, name, email, plan: opts.plan }
}

async function deleteInterest(id: string): Promise<void> {
  const supabase = getTestSupabase()
  await supabase.from('plan_interest').delete().eq('id', id)
}

async function disableSonnerPointerEvents(page: Page) {
  await page.evaluate(() => {
    document
      .querySelectorAll('[data-sonner-toaster], [data-sonner-toast]')
      .forEach((el) => ((el as HTMLElement).style.pointerEvents = 'none'))
  })
}

test.describe('console interesses (admin)', () => {
  test.setTimeout(90_000)

  test('master ve pagina de interesses com header e filtros', async ({ page, context }) => {
    await loginAsMasterViaCookie(context)

    await page.goto('/console/interesses')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { level: 1, name: /interesses em planos/i })).toBeVisible()
    await expect(
      page.getByText(/visitantes que querem ser avisados quando os planos estiverem disponíveis/i),
    ).toBeVisible()

    // Filtros visiveis (botoes nativos)
    await expect(page.getByRole('button', { name: /todos/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^profissional/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /gestão & clínicas/i })).toBeVisible()
  })

  test('interesse seedado aparece na lista com nome, email e badge do plano', async ({ page, context }, testInfo) => {
    await loginAsMasterViaCookie(context)

    const seeded = await seedInterest({ plan: 'profissional', tag: 'list' })

    try {
      await page.goto('/console/interesses')
      await page.waitForLoadState('networkidle')

      if (testInfo.project.name === 'mobile') {
        await disableSonnerPointerEvents(page)
      }

      // Linha da tabela com email unico (mais robusto que name)
      const row = page.locator('tr', { hasText: seeded.email }).first()
      await expect(row).toBeVisible()
      await expect(row.getByText(seeded.name)).toBeVisible()
      await expect(row.getByText(/profissional/i).first()).toBeVisible()
    } finally {
      await deleteInterest(seeded.id)
    }
  })

  test('filtro Profissional oculta linhas de gestao-clinicas', async ({ page, context }, testInfo) => {
    await loginAsMasterViaCookie(context)

    const profissional = await seedInterest({ plan: 'profissional', tag: 'flt-prof' })
    const gestao = await seedInterest({ plan: 'gestao-clinicas', tag: 'flt-gest' })

    try {
      await page.goto('/console/interesses')
      await page.waitForLoadState('networkidle')

      if (testInfo.project.name === 'mobile') {
        await disableSonnerPointerEvents(page)
      }

      // Antes do filtro: ambos visiveis
      await expect(page.locator('tr', { hasText: profissional.email })).toBeVisible()
      await expect(page.locator('tr', { hasText: gestao.email })).toBeVisible()

      // Clica filtro Profissional
      await page.getByRole('button', { name: /^profissional/i }).click()

      await expect(page.locator('tr', { hasText: profissional.email })).toBeVisible()
      await expect(page.locator('tr', { hasText: gestao.email })).toHaveCount(0)
    } finally {
      await deleteInterest(profissional.id)
      await deleteInterest(gestao.id)
    }
  })

  test('filtro Gestao & Clinicas oculta linhas de profissional', async ({ page, context }, testInfo) => {
    await loginAsMasterViaCookie(context)

    const profissional = await seedInterest({ plan: 'profissional', tag: 'flt2-prof' })
    const gestao = await seedInterest({ plan: 'gestao-clinicas', tag: 'flt2-gest' })

    try {
      await page.goto('/console/interesses')
      await page.waitForLoadState('networkidle')

      if (testInfo.project.name === 'mobile') {
        await disableSonnerPointerEvents(page)
      }

      await page.getByRole('button', { name: /gestão & clínicas/i }).click()

      await expect(page.locator('tr', { hasText: gestao.email })).toBeVisible()
      await expect(page.locator('tr', { hasText: profissional.email })).toHaveCount(0)
    } finally {
      await deleteInterest(profissional.id)
      await deleteInterest(gestao.id)
    }
  })

  test('contadores dos filtros incrementam apos seed (tolerante a paralelismo)', async ({ page, context }) => {
    await loginAsMasterViaCookie(context)

    const p1 = await seedInterest({ plan: 'profissional', tag: 'cnt-p1' })
    const p2 = await seedInterest({ plan: 'profissional', tag: 'cnt-p2' })
    const g1 = await seedInterest({ plan: 'gestao-clinicas', tag: 'cnt-g1' })

    try {
      await page.goto('/console/interesses')
      await page.waitForLoadState('networkidle')

      const todosBtn = page.getByRole('button', { name: /todos/i })
      const profBtn = page.getByRole('button', { name: /^profissional/i })
      const gestaoBtn = page.getByRole('button', { name: /gestão & clínicas/i })

      // Extrai o numero exibido nos contadores. Outros viewports rodando em
      // paralelo tambem inserem/deletam, entao validamos apenas que cada
      // contador eh >= ao numero garantido pelos nossos 3 seeds locais.
      const parseCount = async (btn: typeof todosBtn): Promise<number> => {
        const txt = await btn.textContent()
        return parseInt((txt ?? '').replace(/\D+/g, ''), 10)
      }

      const todos = await parseCount(todosBtn)
      const prof = await parseCount(profBtn)
      const gestao = await parseCount(gestaoBtn)

      expect(todos).toBeGreaterThanOrEqual(3)
      expect(prof).toBeGreaterThanOrEqual(2)
      expect(gestao).toBeGreaterThanOrEqual(1)
      // Coerencia interna: Todos == Profissional + Gestao (no momento do render)
      expect(todos).toBe(prof + gestao)
    } finally {
      await deleteInterest(p1.id)
      await deleteInterest(p2.id)
      await deleteInterest(g1.id)
    }
  })
})
