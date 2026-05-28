import { test, expect, type Page } from '@playwright/test'
import { loginAsMasterViaCookie } from '../../fixtures/session'
import { getTestSupabase } from '../../fixtures/supabase'

/**
 * Console / Configuracoes (`/console/settings`):
 *
 * Page server (src/app/(admin)/console/settings/page.tsx) restringe acesso
 * a `role === 'master'` e renderiza `SettingsClient`.
 *
 * Client (src/app/(admin)/console/settings/settings-client.tsx):
 *  - PageHeader "Configuracoes"
 *  - UnderlineTabs com tres abas:
 *      - Perfil        -> TabProfile (edita name do master)
 *      - Seguranca     -> TabSecurity (altera senha: atual + nova + confirmacao)
 *      - Acessibilidade -> TabAccessibility reaproveitada do lado (app), renderizada
 *                          com showRequestCard={false} (master nao envia pedido a si).
 *
 * Mutacao via Server Action `updateMasterProfile` em
 * `src/server/actions/settings.ts`. Atualiza o proprio registro do master
 * (nome e/ou passwordHash). Nao interceptamos por waitForResponse —
 * validamos lendo `users` no Supabase via polling.
 *
 * Isolamento:
 *  - O master eh registro COMPARTILHADO entre testes. Toda edicao captura
 *    snapshot (name + password_hash) e restaura no finally.
 *  - Nao alteramos senha de fato (correria risco de quebrar outros logins
 *    se algo falhasse no restore). Em vez disso, validamos os fluxos de
 *    erro do form de seguranca (senha atual incorreta, confirmacao nao
 *    confere) que nao mutam o banco.
 */

const MASTER_EMAIL = 'projectanamneseai2026@gmail.com'

interface MasterSnapshot {
  id: string
  name: string
  passwordHash: string
}

async function getMaster(): Promise<MasterSnapshot> {
  const supabase = getTestSupabase()
  const { data, error } = await supabase
    .from('users')
    .select('id, name, password_hash')
    .eq('email', MASTER_EMAIL)
    .single()
  if (error || !data) {
    throw new Error(`[e2e] master nao encontrado: ${error?.message}`)
  }
  return {
    id: data.id as string,
    name: data.name as string,
    passwordHash: data.password_hash as string,
  }
}

async function restoreMaster(snapshot: MasterSnapshot): Promise<void> {
  const supabase = getTestSupabase()
  await supabase
    .from('users')
    .update({ name: snapshot.name, password_hash: snapshot.passwordHash })
    .eq('id', snapshot.id)
}

async function waitForMasterName(expected: string, timeoutMs = 15_000): Promise<void> {
  const supabase = getTestSupabase()
  const start = Date.now()
  let last: unknown = null
  while (Date.now() - start < timeoutMs) {
    const { data } = await supabase
      .from('users')
      .select('name')
      .eq('email', MASTER_EMAIL)
      .maybeSingle()
    last = data?.name
    if (last === expected) return
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`[e2e] timeout esperando name=${expected} (atual=${String(last)}) para master`)
}

async function disableSonnerPointerEvents(page: Page) {
  await page.evaluate(() => {
    document
      .querySelectorAll('[data-sonner-toaster], [data-sonner-toast]')
      .forEach((el) => ((el as HTMLElement).style.pointerEvents = 'none'))
  })
}

test.describe('console configuracoes (admin)', () => {
  test.setTimeout(90_000)

  test('master ve pagina de configuracoes com abas Perfil e Seguranca', async ({ page, context }) => {
    await loginAsMasterViaCookie(context)

    await page.goto('/console/settings')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { level: 1, name: /configurações/i })).toBeVisible()
    await expect(page.getByText(/gerencie seu perfil e parâmetros do sistema/i)).toBeVisible()

    // Abas
    await expect(page.getByRole('button', { name: /^perfil$/i }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /^segurança$/i }).first()).toBeVisible()

    // Tab Perfil ativa por padrao — input Nome visivel e botao Salvar habilitado
    await expect(page.getByText(/^nome$/i).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /salvar alterações/i }).first()).toBeEnabled()
  })

  test('editar nome do master persiste no banco', async ({ page, context }, testInfo) => {
    await loginAsMasterViaCookie(context)

    const original = await getMaster()

    try {
      await page.goto('/console/settings')
      await page.waitForLoadState('networkidle')

      if (testInfo.project.name === 'mobile') {
        await disableSonnerPointerEvents(page)
      }

      const newName = `Master E2E ${Date.now()}`

      // Tab Perfil ativa por padrao — primeiro input eh o Nome
      const nameInput = page.locator('input').first()
      await expect(nameInput).toBeVisible()
      await nameInput.fill(newName)

      const saveBtn = page.getByRole('button', { name: /salvar alterações/i }).first()
      await expect(saveBtn).toBeEnabled()
      await saveBtn.click()

      await waitForMasterName(newName)
    } finally {
      await restoreMaster(original)
    }
  })

  test('alternar para aba Seguranca exibe campos de senha', async ({ page, context }) => {
    await loginAsMasterViaCookie(context)

    await page.goto('/console/settings')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /^segurança$/i }).first().click()

    await expect(page.getByText(/^senha atual$/i)).toBeVisible()
    await expect(page.getByText(/^nova senha$/i)).toBeVisible()
    await expect(page.getByText(/^confirmar nova senha$/i)).toBeVisible()

    // Tres inputs password
    const pwdInputs = page.locator('input[type="password"]')
    await expect(pwdInputs).toHaveCount(3)

    await expect(page.getByRole('button', { name: /salvar alterações/i }).first()).toBeEnabled()
  })

  test('senha atual incorreta exibe erro e nao altera password_hash', async ({ page, context }, testInfo) => {
    await loginAsMasterViaCookie(context)

    const original = await getMaster()

    try {
      await page.goto('/console/settings')
      await page.waitForLoadState('networkidle')

      if (testInfo.project.name === 'mobile') {
        await disableSonnerPointerEvents(page)
      }

      await page.getByRole('button', { name: /^segurança$/i }).first().click()

      const pwdInputs = page.locator('input[type="password"]')
      await pwdInputs.nth(0).fill('senha-totalmente-errada-e2e')
      await pwdInputs.nth(1).fill('nova-senha-e2e-123')
      await pwdInputs.nth(2).fill('nova-senha-e2e-123')

      const saveBtn = page.getByRole('button', { name: /salvar alterações/i }).first()
      await expect(saveBtn).toBeEnabled()
      await saveBtn.click()

      // Toast de erro com mensagem retornada pela action
      await expect(page.getByText(/senha atual incorreta/i).first()).toBeVisible({ timeout: 10_000 })

      // Confirma que password_hash nao mudou apos erro
      const after = await getMaster()
      expect(after.passwordHash).toBe(original.passwordHash)
    } finally {
      await restoreMaster(original)
    }
  })

  test('validacao client-side bloqueia submit quando confirmacao nao confere', async ({ page, context }, testInfo) => {
    await loginAsMasterViaCookie(context)

    const original = await getMaster()

    try {
      await page.goto('/console/settings')
      await page.waitForLoadState('networkidle')

      if (testInfo.project.name === 'mobile') {
        await disableSonnerPointerEvents(page)
      }

      await page.getByRole('button', { name: /^segurança$/i }).first().click()

      const pwdInputs = page.locator('input[type="password"]')
      await pwdInputs.nth(0).fill('qualquer-coisa')
      await pwdInputs.nth(1).fill('nova-senha-1')
      await pwdInputs.nth(2).fill('nova-senha-2-diferente')

      // Spy: nenhuma Server Action deve sair com submit invalido
      let serverActionCalled = false
      page.on('request', (req) => {
        if (req.method() === 'POST' && req.headers()['next-action']) {
          serverActionCalled = true
        }
      })

      const saveBtn = page.getByRole('button', { name: /salvar alterações/i }).first()
      await saveBtn.click()

      await expect(page.getByText(/as senhas não coincidem/i).first()).toBeVisible()
      expect(serverActionCalled).toBe(false)

      const after = await getMaster()
      expect(after.passwordHash).toBe(original.passwordHash)
    } finally {
      await restoreMaster(original)
    }
  })

  // Read-only: o master e registro compartilhado, entao NAO clicamos nos toggles
  // (auto-save via PATCH /api/users/me mutaria as prefs do master). Validamos
  // apenas a renderizacao da aba.
  test('aba Acessibilidade exibe os toggles e nao mostra o card de pedido', async ({ page, context }) => {
    await loginAsMasterViaCookie(context)

    await page.goto('/console/settings')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /^acessibilidade$/i }).first().click()

    // Controles de acessibilidade (GA, sempre visiveis)
    await expect(page.getByRole('radio', { name: /normal/i })).toBeVisible()
    await expect(page.getByRole('switch', { name: /alto contraste/i })).toBeVisible()
    await expect(page.getByRole('switch', { name: /espa.amento/i })).toBeVisible()
    await expect(page.getByRole('switch', { name: /destacar foco/i })).toBeVisible()
    await expect(page.getByRole('switch', { name: /reduzir movimento/i })).toBeVisible()

    // Card de pedido nao aparece no console (showRequestCard={false})
    await expect(page.getByText(/falta algum ajuste/i)).toHaveCount(0)
  })
})
