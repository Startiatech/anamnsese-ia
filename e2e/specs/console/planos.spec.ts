import { test, expect, type Page } from '@playwright/test'
import { loginAsMasterViaCookie } from '../../fixtures/session'
import { getTestSupabase } from '../../fixtures/supabase'
import { makeE2eId } from '../../fixtures/auth'

/**
 * Console / Planos (`/console/plans`):
 *
 * Page server (src/app/(admin)/console/plans/page.tsx) busca todos os planos
 * ordenados por `sort_order` e renderiza `PlansClient`.
 *
 * Client (src/app/(admin)/console/plans/plans-client.tsx):
 *  - PageHeader com botao "Novo plano" abre `CreateModal`
 *  - Tabs (UnderlineTabs) por plano — cada aba mostra Card com badges, preco,
 *    franquia, botoes Editar e Remover
 *  - Painel direito lista as `features` do plano selecionado
 *
 * Mutacoes via Server Actions (`src/server/actions/plans.ts`):
 *  - updatePlan / createPlan / deletePlan — Next-Action requests para a URL
 *    da pagina. Nao interceptamos via waitForResponse (overhead alto, fragil);
 *    validamos lendo o estado final no banco via polling.
 *
 * Estrategia de isolamento:
 *  - Planos seedados (`experimental`, `profissional`) sao COMPARTILHADOS com
 *    outros testes. Para edicao, capturamos o valor original e restauramos no
 *    afterEach via SQL direto.
 *  - Plano novo recebe nome prefixado com `e2e-` para cleanup no afterEach.
 */

const E2E_PLAN_PREFIX = 'e2e-'

interface PlanSnapshot {
  id: string
  name: string
  description: string
  price: number
  quota: number
  active: boolean
  features: unknown
  sort_order: number | null
}

async function getPlan(id: string): Promise<PlanSnapshot | null> {
  const supabase = getTestSupabase()
  const { data } = await supabase
    .from('plans')
    .select('id, name, description, price, quota, active, features, sort_order')
    .eq('id', id)
    .maybeSingle()
  if (!data) return null
  return {
    id: data.id as string,
    name: data.name as string,
    description: (data.description as string) ?? '',
    price: Number(data.price),
    quota: Number(data.quota),
    active: Boolean(data.active),
    features: data.features ?? [],
    sort_order: (data.sort_order as number | null) ?? null,
  }
}

async function restorePlan(snapshot: PlanSnapshot): Promise<void> {
  const supabase = getTestSupabase()
  await supabase
    .from('plans')
    .update({
      name: snapshot.name,
      description: snapshot.description,
      price: snapshot.price,
      quota: snapshot.quota,
      active: snapshot.active,
      features: snapshot.features,
      sort_order: snapshot.sort_order,
      updated_at: new Date().toISOString(),
    })
    .eq('id', snapshot.id)
}

async function deleteE2ePlans(): Promise<void> {
  const supabase = getTestSupabase()
  await supabase.from('plans').delete().like('id', `${E2E_PLAN_PREFIX}%`)
}

async function waitForPlanField<T>(
  id: string,
  column: keyof PlanSnapshot,
  predicate: (value: T) => boolean,
  timeoutMs = 15_000,
): Promise<T> {
  const start = Date.now()
  let last: unknown = null
  while (Date.now() - start < timeoutMs) {
    const current = await getPlan(id)
    if (current) {
      last = current[column]
      if (predicate(last as T)) return last as T
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(
    `[e2e] timeout esperando ${String(column)} satisfazer predicate (ultimo valor=${JSON.stringify(last)}) no plano ${id}`,
  )
}

async function waitForPlanDeleted(id: string, timeoutMs = 15_000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const current = await getPlan(id)
    if (!current) return
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`[e2e] timeout esperando plano ${id} ser removido`)
}

async function disableSonnerPointerEvents(page: Page) {
  await page.evaluate(() => {
    document
      .querySelectorAll('[data-sonner-toaster], [data-sonner-toast]')
      .forEach((el) => ((el as HTMLElement).style.pointerEvents = 'none'))
  })
}

async function openPlanTab(page: Page, planName: string): Promise<void> {
  // UnderlineTabs renderiza botoes com o label do plano
  const tab = page.getByRole('button', { name: new RegExp(`^${planName}$`, 'i') }).first()
  await expect(tab).toBeVisible()
  await tab.click()
}

test.describe('console planos (admin)', () => {
  test.setTimeout(90_000)

  test.afterEach(async () => {
    await deleteE2ePlans()
  })

  test('master ve planos seedados (experimental e profissional)', async ({ page, context }) => {
    await loginAsMasterViaCookie(context)

    await page.goto('/console/plans')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { level: 1, name: /planos/i })).toBeVisible()
    await expect(page.getByText(/gerencie os planos disponíveis/i)).toBeVisible()

    // Botao "Novo plano" visivel
    await expect(page.getByRole('button', { name: /novo plano/i }).first()).toBeEnabled()

    // Abas dos planos seedados
    await expect(page.getByRole('button', { name: /^experimental$/i }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /^profissional$/i }).first()).toBeVisible()
  })

  test('editar plano experimental persiste preco/quota/descricao no banco', async ({ page, context }, testInfo) => {
    await loginAsMasterViaCookie(context)

    const original = await getPlan('experimental')
    expect(original).not.toBeNull()
    if (!original) throw new Error('seed do plano experimental ausente')

    try {
      await page.goto('/console/plans')
      await page.waitForLoadState('networkidle')

      if (testInfo.project.name === 'mobile') {
        await disableSonnerPointerEvents(page)
      }

      await openPlanTab(page, 'Experimental')

      const editBtn = page.getByRole('button', { name: /^editar$/i }).first()
      await expect(editBtn).toBeEnabled()
      await editBtn.click()

      // Modal aberto — heading "Editar — Experimental"
      await expect(page.getByRole('heading', { name: /editar — experimental/i })).toBeVisible()

      const newDescription = `E2E descricao ${Date.now()}`
      const newPrice = (original.price ?? 0) + 13
      const newQuota = (original.quota ?? 0) + 7

      // Localiza inputs pelas labels do PlanFormFields
      // labels: Nome, Descricao, Preco (R$/mes), Franquia (atendimentos/mes)
      const descInput = page.locator('input').filter({ hasNot: page.locator('[type="number"]') }).nth(1)
      await descInput.fill(newDescription)

      const numericInputs = page.locator('input[type="number"]')
      await numericInputs.nth(0).fill(String(newPrice))
      await numericInputs.nth(1).fill(String(newQuota))

      const saveBtn = page.getByRole('button', { name: /salvar alterações/i })
      await expect(saveBtn).toBeEnabled()
      await saveBtn.click()

      await waitForPlanField<number>('experimental', 'price', (v) => v === newPrice)
      await waitForPlanField<number>('experimental', 'quota', (v) => v === newQuota)
      await waitForPlanField<string>('experimental', 'description', (v) => v === newDescription)
    } finally {
      await restorePlan(original)
    }
  })

  test('toggle de ativo alterna estado do plano profissional no banco', async ({ page, context }, testInfo) => {
    await loginAsMasterViaCookie(context)

    const original = await getPlan('profissional')
    expect(original).not.toBeNull()
    if (!original) throw new Error('seed do plano profissional ausente')

    try {
      await page.goto('/console/plans')
      await page.waitForLoadState('networkidle')

      if (testInfo.project.name === 'mobile') {
        await disableSonnerPointerEvents(page)
      }

      await openPlanTab(page, 'Profissional')

      const editBtn = page.getByRole('button', { name: /^editar$/i }).first()
      await expect(editBtn).toBeEnabled()
      await editBtn.click()

      await expect(page.getByRole('heading', { name: /editar — profissional/i })).toBeVisible()

      // Toggle "Plano ativo" — botao adjacente ao label
      const toggleRow = page.getByText(/^plano ativo$/i).locator('..')
      const toggleBtn = toggleRow.getByRole('button').first()
      await expect(toggleBtn).toBeVisible()
      await toggleBtn.click()

      const saveBtn = page.getByRole('button', { name: /salvar alterações/i })
      await expect(saveBtn).toBeEnabled()
      await saveBtn.click()

      const flipped = !original.active
      await waitForPlanField<boolean>('profissional', 'active', (v) => v === flipped)
    } finally {
      await restorePlan(original)
    }
  })

  test('botao criar fica desabilitado quando nome esta vazio', async ({ page, context }) => {
    await loginAsMasterViaCookie(context)

    await page.goto('/console/plans')
    await page.waitForLoadState('networkidle')

    const novoBtn = page.getByRole('button', { name: /novo plano/i }).first()
    await expect(novoBtn).toBeEnabled()
    await novoBtn.click()

    await expect(page.getByRole('heading', { name: /^novo plano$/i })).toBeVisible()

    // Sem preencher nome, "Criar plano" fica disabled
    const criarBtn = page.getByRole('button', { name: /^criar plano$/i })
    await expect(criarBtn).toBeDisabled()

    // Spy: garante que nenhuma chamada de Server Action sai
    let serverActionCalled = false
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.headers()['next-action']) {
        serverActionCalled = true
      }
    })

    // Tentativa de click nao dispara nada (botao desabilitado)
    await criarBtn.click({ force: true }).catch(() => {})

    // Modal continua aberto e nenhuma Server Action saiu
    await expect(page.getByRole('heading', { name: /^novo plano$/i })).toBeVisible()
    expect(serverActionCalled).toBe(false)
  })

  test('criar novo plano e2e persiste no banco e aparece como aba', async ({ page, context }, testInfo) => {
    await loginAsMasterViaCookie(context)

    const uniqueId = makeE2eId('e2e-plan')
    // createPlan deriva o id de plan.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    // Mantemos o nome ja em formato slug para garantir id previsivel com prefixo e2e-
    const planName = uniqueId
    const expectedId = planName

    await page.goto('/console/plans')
    await page.waitForLoadState('networkidle')

    if (testInfo.project.name === 'mobile') {
      await disableSonnerPointerEvents(page)
    }

    const novoBtn = page.getByRole('button', { name: /novo plano/i }).first()
    await expect(novoBtn).toBeEnabled()
    await novoBtn.click()

    await expect(page.getByRole('heading', { name: /^novo plano$/i })).toBeVisible()

    // Preenche campos no CreateModal
    const allTextInputs = page.locator('input:not([type="number"])')
    await allTextInputs.nth(0).fill(planName) // Nome
    await allTextInputs.nth(1).fill('Plano criado em teste E2E') // Descricao

    const numericInputs = page.locator('input[type="number"]')
    await numericInputs.nth(0).fill('42') // Preco
    await numericInputs.nth(1).fill('15') // Quota

    const criarBtn = page.getByRole('button', { name: /^criar plano$/i })
    await expect(criarBtn).toBeEnabled()
    await criarBtn.click()

    // Valida persistencia no banco
    const created = await waitForPlanField<string>(expectedId, 'name', (v) => v === planName)
    expect(created).toBe(planName)

    const snapshot = await getPlan(expectedId)
    expect(snapshot?.price).toBe(42)
    expect(snapshot?.quota).toBe(15)
    expect(snapshot?.active).toBe(true)
    expect(snapshot?.description).toBe('Plano criado em teste E2E')
  })

  test('remover plano e2e exclui do banco', async ({ page, context }, testInfo) => {
    await loginAsMasterViaCookie(context)

    // Cria plano direto no banco para testar exclusao via UI
    const uniqueId = makeE2eId('e2e-del')
    const planId = uniqueId
    const planName = uniqueId

    const supabase = getTestSupabase()
    const { error: insertErr } = await supabase.from('plans').insert({
      id: planId,
      name: planName,
      description: 'Plano para teste de exclusao E2E',
      price: 10,
      quota: 5,
      active: true,
      features: [],
      sort_order: 99,
      updated_at: new Date().toISOString(),
    })
    if (insertErr) throw new Error(`[e2e] seed do plano de exclusao falhou: ${insertErr.message}`)

    await page.goto('/console/plans')
    await page.waitForLoadState('networkidle')

    if (testInfo.project.name === 'mobile') {
      await disableSonnerPointerEvents(page)
    }

    await openPlanTab(page, planName)

    // Botao Remover na aba atual
    const removerBtn = page.getByRole('button', { name: /^remover$/i }).first()
    await expect(removerBtn).toBeEnabled()

    // Endpoint GET /api/admin/plans/[id] eh chamado ao abrir o modal de exclusao
    const userCountResp = page.waitForResponse(
      (resp) => resp.url().includes(`/api/admin/plans/${planId}`) && resp.request().method() === 'GET',
      { timeout: 15_000 },
    )
    await removerBtn.click()
    const userCountRes = await userCountResp
    expect(userCountRes.ok()).toBe(true)

    // Modal de confirmacao com botao Remover destrutivo
    await expect(page.getByRole('heading', { name: /^remover plano$/i })).toBeVisible()

    const confirmarBtn = page.getByRole('button', { name: /^remover$/i }).last()
    await expect(confirmarBtn).toBeEnabled()
    await confirmarBtn.click()

    await waitForPlanDeleted(planId)
  })
})
