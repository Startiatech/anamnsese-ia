import { test, expect } from '@playwright/test'
import { createTestUser, loginAsUser } from '../../fixtures/auth'
import { getTestSupabase } from '../../fixtures/supabase'
import { seedClinicForUser } from '../../fixtures/seed'

/**
 * Configuracoes do usuario — descoberta de implementacao:
 *
 * Rota: `/settings` (src/app/(app)/settings/page.tsx -> SettingsClient).
 *
 * Tabs (UnderlineTabs, botoes simples nao role=tab):
 *   - "Perfil"     -> TabProfile     (name, phone, specialty, crmType, crmNumber, crmUf,
 *                                     minutesPerConsultation) — submit POST /api/users/me ->
 *                                     toast "Perfil atualizado!"
 *   - "Clínica"    -> TabClinic      (clinicName, clinicCnpj, clinicPhone, clinicEmail,
 *                                     clinicCep, clinicAddress, clinicAddressNumber, etc.) —
 *                                     toast "Dados da clínica salvos."
 *   - "Segurança"  -> TabSecurity    (senha, PIN, danger zone).
 *
 * Para um usuario nao-onboarding (createTestUser cria com onboarding_completed:true)
 * cada tab tem seu proprio botao "Salvar alterações". Todos os tabs ficam montados
 * (display:none) entao queries .first() retornam a tab ativa quando elementos sao
 * unicos por nome.
 *
 * Inputs usam <FieldInput> nativo com <FieldLabel> via htmlFor — getByLabel
 * funciona. Mas como ha campos com labels "Nome..." em multiplas tabs, usamos
 * locators escopados ao container da tab ativa.
 *
 * Persistencia: SELECT na tabela `users` para validar mudanca apos save.
 */
test.describe('configuracoes do usuario', () => {
  test.setTimeout(120_000)

  test('edita nome e telefone do perfil e persiste no banco', async ({ page }) => {
    const user = await createTestUser({ role: 'user' })
    // Pre-popula campos obrigatorios do perfil (specialty/CRM) para nao bloquear o save
    await getTestSupabase()
      .from('users')
      .update({
        specialty: 'Clinica Geral',
        crm_type: 'CRM',
        crm_number: '123456',
        crm_uf: 'SP',
      })
      .eq('id', user.id)

    await loginAsUser(page, user)

    await page.goto('/app/settings')
    await page.waitForLoadState('networkidle')

    // Tab "Perfil" ja eh a inicial — confirma renderizacao
    await expect(page.getByRole('heading', { name: /configura[cç][oõ]es/i })).toBeVisible({
      timeout: 30_000,
    })

    const novoNome = `E2E Nome ${Date.now()}`
    const nomeInput = page.getByTestId('settings-profile-name')
    await expect(nomeInput).toBeVisible()
    await nomeInput.fill(novoNome)

    const telInput = page.getByTestId('settings-profile-phone')
    await telInput.fill('(11) 98888-7777')

    // Botao "Salvar alterações" do form de Perfil
    const salvar = page.getByRole('button', { name: /salvar altera[cç][oõ]es/i }).first()
    await expect(salvar).toBeEnabled()
    // Dispensar toasts Sonner ativos antes do click (mobile)
    await page.evaluate(() => {
      document.querySelectorAll('[data-sonner-toaster], [data-sonner-toast]').forEach((el) => {
        ;(el as HTMLElement).style.pointerEvents = 'none'
      })
    })
    await salvar.click()

    await expect(page.getByText(/perfil atualizado/i)).toBeVisible({ timeout: 15_000 })

    // Confirma persistencia no banco
    const supabase = getTestSupabase()
    const { data } = await supabase
      .from('users')
      .select('name, phone')
      .eq('id', user.id)
      .single()
    expect(data?.name).toBe(novoNome)
    expect((data?.phone ?? '').replace(/\D/g, '')).toBe('11988887777')
  })

  test('edita dados da clinica e persiste no banco', async ({ page }) => {
    const user = await createTestUser({ role: 'user' })
    // Tab Clinica requer todos os campos obrigatorios preenchidos para salvar.
    // Seedamos um estado base; o teste apenas TROCA nome+CNPJ.
    await seedClinicForUser(user.id)
    await loginAsUser(page, user)

    await page.goto('/app/settings')
    await page.waitForLoadState('networkidle')

    // Troca para a tab "Clínica" (botao simples com texto exato)
    const tabClinica = page.getByRole('button', { name: /^cl[ií]nica$/i }).first()
    await expect(tabClinica).toBeVisible({ timeout: 30_000 })
    await expect(tabClinica).toBeEnabled()
    await tabClinica.click()

    // Confirma que a tab Clinica esta ativa via testid do input
    const nomeClinicaInput = page.getByTestId('settings-clinic-name')
    await expect(nomeClinicaInput).toBeVisible({ timeout: 10_000 })

    const novoNomeClinica = `E2E Clinica ${Date.now()}`
    await nomeClinicaInput.fill(novoNomeClinica)
    await page.getByTestId('settings-clinic-cnpj').fill('11.222.333/0001-81')

    const salvar = page.getByRole('button', { name: /salvar altera[cç][oõ]es/i }).first()
    await expect(salvar).toBeEnabled()
    await page.evaluate(() => {
      document.querySelectorAll('[data-sonner-toaster], [data-sonner-toast]').forEach((el) => {
        ;(el as HTMLElement).style.pointerEvents = 'none'
      })
    })
    await salvar.click()

    await expect(page.getByText(/dados da cl[ií]nica salvos/i)).toBeVisible({ timeout: 15_000 })

    // Persistencia: clinic_name no banco (CNPJ pode ser normalizado, validamos o nome)
    const supabase = getTestSupabase()
    const { data } = await supabase
      .from('users')
      .select('clinic_name, clinic_cnpj')
      .eq('id', user.id)
      .single()
    expect(data?.clinic_name).toBe(novoNomeClinica)
    expect((data?.clinic_cnpj ?? '').replace(/\D/g, '')).toBe('11222333000181')
  })
})
