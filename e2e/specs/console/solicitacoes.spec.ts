import { test, expect } from '@playwright/test'
import { loginAsMasterViaCookie } from '../../fixtures/session'
import { createAccessRequest } from '../../fixtures/seed'
import { getTestSupabase } from '../../fixtures/supabase'

/**
 * Solicitacoes de acesso (`/console/requests`):
 *
 * Page server (src/app/(admin)/console/requests/page.tsx) busca todas as rows
 * de `access_requests` ordenadas por `created_at desc` e renderiza
 * `RequestsClient`.
 *
 * Client (src/app/(admin)/console/requests/requests-client.tsx):
 *  - Filtros: Todas / Pendentes / Aprovadas / Rejeitadas
 *  - Tabela com Solicitante, Especialidade, Telefone, Mensagem, Situação, Data
 *  - Linhas com status `pending` mostram DropdownMenu (MoreHorizontal) com
 *    itens "Aprovar" e "Rejeitar"
 *
 * Aprovar:
 *  - Gera senha temporaria, abre WhatsApp via window.open(...)
 *  - POST /api/admin/create-user (cria user com role=user, planId=experimental,
 *    passwordIsTemp=true)
 *  - PATCH /api/requests/[id] { status: 'approved' }
 *
 * Rejeitar:
 *  - Abre WhatsApp via window.open(...)
 *  - PATCH /api/requests/[id] { status: 'rejected' }
 *
 * Cada teste seeda sua propria `access_request` via createAccessRequest()
 * (prefixo `e2e-req-*`, limpo no globalTeardown).
 *
 * window.open e stubado via init script para evitar abertura real de aba
 * e nao afetar o popup-blocker do Playwright.
 */

/**
 * Polling helper: busca a row de access_requests por id ate o status mudar
 * ou esgotar timeout. Evita waitForTimeout — usa loop curto controlado.
 */
async function waitForRequestStatus(id: string, expected: 'approved' | 'rejected', timeoutMs = 15_000) {
  const supabase = getTestSupabase()
  const start = Date.now()
  let lastStatus: string | null = null
  while (Date.now() - start < timeoutMs) {
    const { data } = await supabase
      .from('access_requests')
      .select('status')
      .eq('id', id)
      .single()
    lastStatus = (data?.status as string) ?? null
    if (lastStatus === expected) return
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`[e2e] timeout esperando status=${expected} (atual=${lastStatus}) para request ${id}`)
}

async function waitForUserCreated(email: string, timeoutMs = 15_000): Promise<{ id: string; role: string } | null> {
  const supabase = getTestSupabase()
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const { data } = await supabase
      .from('users')
      .select('id, role')
      .eq('email', email)
      .maybeSingle()
    if (data) return { id: data.id, role: data.role as string }
    await new Promise((r) => setTimeout(r, 250))
  }
  return null
}

test.describe('console requests (admin)', () => {
  test.setTimeout(90_000)

  test('master ve solicitacao pendente seedada na tabela', async ({ page, context }) => {
    await loginAsMasterViaCookie(context)
    const seeded = await createAccessRequest()

    await page.goto('/console/requests')
    await page.waitForLoadState('networkidle')

    // PageHeader
    await expect(page.getByRole('heading', { level: 1, name: /solicitações de acesso/i })).toBeVisible()
    await expect(page.getByText(/gerencie os pedidos de acesso/i)).toBeVisible()

    // Filtros visiveis
    await expect(page.getByRole('button', { name: /^todas \(/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^pendentes \(/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^aprovadas \(/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^rejeitadas \(/i })).toBeVisible()

    // A row seedada aparece (email unico e2e-req-*)
    await expect(page.getByText(seeded.email)).toBeVisible({ timeout: 10_000 })
  })

  test('filtro "Pendentes" mostra apenas solicitacoes pending', async ({ page, context }) => {
    await loginAsMasterViaCookie(context)
    const seeded = await createAccessRequest()

    await page.goto('/console/requests')
    await page.waitForLoadState('networkidle')

    const pendentesBtn = page.getByRole('button', { name: /^pendentes \(/i })
    await expect(pendentesBtn).toBeEnabled()
    await pendentesBtn.click()

    // A row seedada (status=pending) continua visivel
    await expect(page.getByText(seeded.email)).toBeVisible({ timeout: 10_000 })

    // Ao mudar para "Aprovadas", a row some
    const aprovadasBtn = page.getByRole('button', { name: /^aprovadas \(/i })
    await expect(aprovadasBtn).toBeEnabled()
    await aprovadasBtn.click()
    await expect(page.getByText(seeded.email)).toHaveCount(0)
  })

  test('aprovar solicitacao cria user e muda status para approved', async ({ page, context }, testInfo) => {
    await loginAsMasterViaCookie(context)
    const seeded = await createAccessRequest()

    // Stub window.open antes de qualquer navegacao para nao abrir WhatsApp
    await context.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as unknown as { open: (...args: unknown[]) => null }).open = () => null
    })

    await page.goto('/console/requests')
    await page.waitForLoadState('networkidle')

    const isMobile = testInfo.project.name === 'mobile'
    if (isMobile) {
      await page.evaluate(() => {
        document
          .querySelectorAll('[data-sonner-toaster], [data-sonner-toast]')
          .forEach((el) => ((el as HTMLElement).style.pointerEvents = 'none'))
      })
    }

    // Encontra a linha pelo email seedado
    const row = page.getByRole('row').filter({ hasText: seeded.email })
    await expect(row).toBeVisible({ timeout: 10_000 })

    const menuTrigger = row.getByRole('button').last()
    await expect(menuTrigger).toBeEnabled()
    await menuTrigger.click()

    const aprovarItem = page.getByRole('menuitem', { name: /aprovar/i })
    await expect(aprovarItem).toBeVisible()

    // Captura as duas respostas da API em paralelo ao click para garantir
    // que o fluxo completou (handleApprove faz POST + PATCH em sequencia).
    const createUserResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/admin/create-user') && resp.request().method() === 'POST',
      { timeout: 20_000 },
    )
    await aprovarItem.click()
    const createRes = await createUserResponse
    if (createRes.status() !== 200 && createRes.status() !== 201) {
      const body = await createRes.text().catch(() => '<no body>')
      throw new Error(`[e2e] create-user falhou ${createRes.status()}: ${body}`)
    }

    // Confirma persistencia no banco
    await waitForRequestStatus(seeded.id, 'approved')

    const created = await waitForUserCreated(seeded.email)
    expect(created).not.toBeNull()
    expect(created?.role).toBe('user')
  })

  test('rejeitar solicitacao muda status para rejected sem criar user', async ({ page, context }, testInfo) => {
    await loginAsMasterViaCookie(context)
    const seeded = await createAccessRequest()

    await context.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as unknown as { open: (...args: unknown[]) => null }).open = () => null
    })

    await page.goto('/console/requests')
    await page.waitForLoadState('networkidle')

    const isMobile = testInfo.project.name === 'mobile'
    if (isMobile) {
      await page.evaluate(() => {
        document
          .querySelectorAll('[data-sonner-toaster], [data-sonner-toast]')
          .forEach((el) => ((el as HTMLElement).style.pointerEvents = 'none'))
      })
    }

    const row = page.getByRole('row').filter({ hasText: seeded.email })
    await expect(row).toBeVisible({ timeout: 10_000 })

    const menuTrigger = row.getByRole('button').last()
    await expect(menuTrigger).toBeEnabled()
    await menuTrigger.click()

    const rejeitarItem = page.getByRole('menuitem', { name: /rejeitar/i })
    await expect(rejeitarItem).toBeVisible()
    await rejeitarItem.click()

    await waitForRequestStatus(seeded.id, 'rejected')

    // Confirma que nao criou user
    const supabase = getTestSupabase()
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('email', seeded.email)
      .maybeSingle()
    expect(user).toBeNull()
  })

  test('mensagem da solicitacao fica acessivel via tooltip "Ver"', async ({ page, context }) => {
    await loginAsMasterViaCookie(context)
    const seeded = await createAccessRequest()

    await page.goto('/console/requests')
    await page.waitForLoadState('networkidle')

    const row = page.getByRole('row').filter({ hasText: seeded.email })
    await expect(row).toBeVisible({ timeout: 10_000 })

    // O botao "Ver" da coluna Mensagem existe na linha (createAccessRequest seeda message='Teste E2E')
    const verBtn = row.getByRole('button', { name: /^ver$/i })
    await expect(verBtn).toBeVisible()
  })
})
