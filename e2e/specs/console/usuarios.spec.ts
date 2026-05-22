import { test, expect } from '@playwright/test'
import { loginAsMasterViaCookie } from '../../fixtures/session'
import { createTestUser, makeE2eId } from '../../fixtures/auth'
import { getTestSupabase } from '../../fixtures/supabase'

/**
 * Console / Usuarios (`/console/users`):
 *
 * Page server (src/app/(admin)/console/users/page.tsx) lista usuarios e
 * renderiza `UsersClient`.
 *
 * Client (src/app/(admin)/console/users/users-client.tsx):
 *  - PageHeader com botao "Novo usuario" abre `AddUserModal` (AppDialog)
 *  - Tabela lista users com colunas Profissional, Especialidade, Status,
 *    Creditos, Custo Groq, Cadastro, Acoes
 *  - Acoes por linha: Editar (Pencil), Excluir (Trash2), DropdownMenu com
 *    Bloquear/Desbloquear, Injetar creditos, Redefinir/Gerar PIN
 *
 * Endpoints relevantes:
 *  - POST /api/admin/create-user — cria user
 *  - PATCH /api/admin/users/[id] — atualiza name/specialty/phone/blocked
 *  - DELETE /api/admin/users/[id] — remove user
 *
 * AddUserModal chama `window.open(wa.me/...)` antes do POST — stubamos
 * para nao abrir aba real.
 *
 * Todos os emails usam prefixo e2e-* (limpos no globalTeardown).
 */

async function waitForUserByEmail(
  email: string,
  timeoutMs = 15_000,
): Promise<{ id: string; name: string; specialty: string | null; blocked: boolean } | null> {
  const supabase = getTestSupabase()
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const { data } = await supabase
      .from('users')
      .select('id, name, specialty, blocked')
      .eq('email', email)
      .maybeSingle()
    if (data) {
      return {
        id: data.id as string,
        name: data.name as string,
        specialty: (data.specialty as string | null) ?? null,
        blocked: Boolean(data.blocked),
      }
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  return null
}

async function waitForUserField<T>(
  id: string,
  column: string,
  expected: T,
  timeoutMs = 15_000,
): Promise<void> {
  const supabase = getTestSupabase()
  const start = Date.now()
  let last: unknown = null
  while (Date.now() - start < timeoutMs) {
    const { data } = await supabase
      .from('users')
      .select(column)
      .eq('id', id)
      .single<Record<string, unknown>>()
    last = data?.[column]
    if (last === expected) return
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`[e2e] timeout esperando ${column}=${String(expected)} (atual=${String(last)}) para user ${id}`)
}

async function disableSonnerPointerEvents(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    document
      .querySelectorAll('[data-sonner-toaster], [data-sonner-toast]')
      .forEach((el) => ((el as HTMLElement).style.pointerEvents = 'none'))
  })
}

test.describe('console users (admin)', () => {
  test.setTimeout(90_000)

  test('master ve tabela de usuarios renderizada', async ({ page, context }) => {
    await loginAsMasterViaCookie(context)
    // Garante que ao menos um usuario seedado aparece
    const seeded = await createTestUser({ role: 'user' })

    await page.goto('/console/users')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { level: 1, name: /usuários/i })).toBeVisible()
    await expect(page.getByText(/profissionais com acesso/i)).toBeVisible()

    // Botao de criar visivel e habilitado
    const novoBtn = page.getByRole('button', { name: /novo usuário/i }).first()
    await expect(novoBtn).toBeEnabled()

    // Filtros (busca + select status)
    await expect(page.getByPlaceholder(/buscar por nome ou e-mail/i)).toBeVisible()

    // O usuario seedado aparece na tabela
    await expect(page.getByText(seeded.email)).toBeVisible({ timeout: 10_000 })
  })

  test('criar usuario via modal persiste no banco', async ({ page, context }, testInfo) => {
    await loginAsMasterViaCookie(context)

    // Stub window.open para nao abrir WhatsApp
    await context.addInitScript(() => {
      ;(window as unknown as { open: (...args: unknown[]) => null }).open = () => null
    })

    await page.goto('/console/users')
    await page.waitForLoadState('networkidle')

    if (testInfo.project.name === 'mobile') {
      await disableSonnerPointerEvents(page)
    }

    const novoBtn = page.getByRole('button', { name: /novo usuário/i }).first()
    await expect(novoBtn).toBeEnabled()
    await novoBtn.click()

    // Modal aberto
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('heading', { name: /novo usuário/i })).toBeVisible()

    const uniqueId = makeE2eId('e2e-user')
    const email = `${uniqueId}@test.com`
    const name = `E2E ${uniqueId}`
    const specialty = 'Cardiologia'

    // Inputs nao tem aria-label — usar associacao via texto do label proximo
    // Aqui usamos placeholders unicos do AddUserModal
    await page.getByPlaceholder(/Dr\. João Silva/i).fill(name)
    await page.getByPlaceholder(/joao@clinica\.com/i).fill(email)
    await page.getByPlaceholder(/Clínica Geral, Cardiologia/i).fill(specialty)
    await page.getByPlaceholder(/\(11\) 99999-9999/i).fill('11988887777')

    const submitBtn = page.getByRole('button', { name: /criar e enviar acesso/i })
    await expect(submitBtn).toBeEnabled()

    const createUserResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/admin/create-user') && resp.request().method() === 'POST',
      { timeout: 20_000 },
    )
    await submitBtn.click()
    const createRes = await createUserResponse
    if (createRes.status() !== 200 && createRes.status() !== 201) {
      const body = await createRes.text().catch(() => '<no body>')
      throw new Error(`[e2e] create-user falhou ${createRes.status()}: ${body}`)
    }

    const created = await waitForUserByEmail(email)
    expect(created).not.toBeNull()
    expect(created?.name).toBe(name)
    expect(created?.specialty).toBe(specialty)
    expect(created?.blocked).toBe(false)
  })

  test('validacao Zod bloqueia submit com campos invalidos', async ({ page, context }) => {
    await loginAsMasterViaCookie(context)

    await page.goto('/console/users')
    await page.waitForLoadState('networkidle')

    const novoBtn = page.getByRole('button', { name: /novo usuário/i }).first()
    await expect(novoBtn).toBeEnabled()
    await novoBtn.click()

    await expect(page.getByRole('dialog')).toBeVisible()

    // Preenche email invalido e demais campos curtos demais para disparar erros
    await page.getByPlaceholder(/Dr\. João Silva/i).fill('A') // < 2 chars
    await page.getByPlaceholder(/joao@clinica\.com/i).fill('nao-eh-email')
    await page.getByPlaceholder(/Clínica Geral, Cardiologia/i).fill('X') // < 2
    await page.getByPlaceholder(/\(11\) 99999-9999/i).fill('123') // < 8

    // Spy: garante que NAO sai POST
    let createUserCalled = false
    page.on('request', (req) => {
      if (req.url().includes('/api/admin/create-user') && req.method() === 'POST') {
        createUserCalled = true
      }
    })

    const submitBtn = page.getByRole('button', { name: /criar e enviar acesso/i })
    await expect(submitBtn).toBeEnabled()
    await submitBtn.click()

    // Mensagens de erro do Zod aparecem
    await expect(page.getByText(/Nome deve ter pelo menos 2 caracteres/i)).toBeVisible()
    await expect(page.getByText(/Email inválido/i)).toBeVisible()

    // Dialog continua aberto
    await expect(page.getByRole('dialog')).toBeVisible()
    expect(createUserCalled).toBe(false)
  })

  test('bloquear e desbloquear usuario altera flag no banco', async ({ page, context }, testInfo) => {
    await loginAsMasterViaCookie(context)
    const seeded = await createTestUser({ role: 'user' })

    await page.goto('/console/users')
    await page.waitForLoadState('networkidle')

    if (testInfo.project.name === 'mobile') {
      await disableSonnerPointerEvents(page)
    }

    // Filtra pela linha do usuario seedado
    const row = page.getByRole('row').filter({ hasText: seeded.email })
    await expect(row).toBeVisible({ timeout: 10_000 })

    // O menu MoreHorizontal eh o ultimo botao da linha
    const menuTrigger = row.getByRole('button').last()
    await expect(menuTrigger).toBeEnabled()
    await menuTrigger.click()

    const bloquearItem = page.getByRole('menuitem', { name: /^bloquear$/i })
    await expect(bloquearItem).toBeVisible()

    const blockResp = page.waitForResponse(
      (resp) => resp.url().includes(`/api/admin/users/${seeded.id}`) && resp.request().method() === 'PATCH',
      { timeout: 20_000 },
    )
    await bloquearItem.click()
    const blockRes = await blockResp
    expect(blockRes.ok()).toBe(true)

    await waitForUserField(seeded.id, 'blocked', true)

    // Reabre o menu para desbloquear
    if (testInfo.project.name === 'mobile') {
      await disableSonnerPointerEvents(page)
    }
    await expect(menuTrigger).toBeEnabled()
    await menuTrigger.click()

    const desbloquearItem = page.getByRole('menuitem', { name: /desbloquear/i })
    await expect(desbloquearItem).toBeVisible()

    const unblockResp = page.waitForResponse(
      (resp) => resp.url().includes(`/api/admin/users/${seeded.id}`) && resp.request().method() === 'PATCH',
      { timeout: 20_000 },
    )
    await desbloquearItem.click()
    const unblockRes = await unblockResp
    expect(unblockRes.ok()).toBe(true)

    await waitForUserField(seeded.id, 'blocked', false)
  })

  test('editar usuario altera especialidade no banco', async ({ page, context }, testInfo) => {
    await loginAsMasterViaCookie(context)
    const seeded = await createTestUser({ role: 'user' })

    await page.goto('/console/users')
    await page.waitForLoadState('networkidle')

    if (testInfo.project.name === 'mobile') {
      await disableSonnerPointerEvents(page)
    }

    const row = page.getByRole('row').filter({ hasText: seeded.email })
    await expect(row).toBeVisible({ timeout: 10_000 })

    // Botao de editar (Pencil) tem title="Editar"
    const editBtn = row.getByRole('button', { name: /editar/i }).first()
    await expect(editBtn).toBeEnabled()
    await editBtn.click()

    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('heading', { name: /editar usuário/i })).toBeVisible()

    // Pega o input de especialidade (segundo input do form #edit-user-form)
    const form = page.locator('#edit-user-form')
    const specialtyInput = form.locator('input').nth(1)
    await specialtyInput.fill('Dermatologia E2E')

    const submitBtn = page.getByRole('button', { name: /salvar alterações/i })
    await expect(submitBtn).toBeEnabled()

    const patchResp = page.waitForResponse(
      (resp) => resp.url().includes(`/api/admin/users/${seeded.id}`) && resp.request().method() === 'PATCH',
      { timeout: 20_000 },
    )
    await submitBtn.click()
    const patchRes = await patchResp
    expect(patchRes.ok()).toBe(true)

    await waitForUserField(seeded.id, 'specialty', 'Dermatologia E2E')
  })

  test('busca filtra a tabela por email do usuario', async ({ page, context }) => {
    await loginAsMasterViaCookie(context)
    const seeded = await createTestUser({ role: 'user' })

    await page.goto('/console/users')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(seeded.email)).toBeVisible({ timeout: 10_000 })

    const search = page.getByPlaceholder(/buscar por nome ou e-mail/i)
    await search.fill(seeded.email)

    // A row do seedado permanece
    await expect(page.getByText(seeded.email)).toBeVisible()

    // Termo sem correspondencia: empty state aparece
    await search.fill('zzz-no-match-xyz-' + Date.now())
    await expect(page.getByText(/nenhum usuário encontrado/i)).toBeVisible()
  })
})
