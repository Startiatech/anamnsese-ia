import { test, expect } from '@playwright/test'
import { createTestUser, loginAsUser } from '../../fixtures/auth'
import { createPatient, seedClinicForUser } from '../../fixtures/seed'
import { mockAiEndpoints } from '../../fixtures/mocks'

/**
 * Fluxo de consulta — descoberta de implementacao:
 *
 * Rotas:
 *   - `/consultation` (lista de pacientes) -> src/app/(app)/consultation/page.tsx
 *     Renderiza ConsultationPageClient com botao "Iniciar atendimento" por linha.
 *     Bloqueia inicio se clinica incompleta (modal "Complete os dados da sua clinica")
 *     ou se creditos == 0.
 *   - `/consultation/[id]` (fluxo) -> src/app/(session)/consultation/[id]/page.tsx
 *     Renderiza ConsultationPageFlow + ConsultationProvider. Re-checa clinic
 *     completa (redireciona p/ /settings se nao). 5 steps em StepIndicator.
 *
 * Steps (src/components/steps/):
 *   1. StepPatient        — "Confirmar paciente" -> botao "Confirmar e continuar"
 *      Abre CreditInfoModal -> botao "Confirmar inicio" debita 1 credito.
 *   2. StepResponsibility — "Autorizacao de Gravacao" -> checkbox + "Continuar".
 *      Chama saveRecordingConsent (Server Action).
 *   3. StepAudio          — Tabs "Enviar arquivo" | "Gravar consulta".
 *      Para evitar microfone real, usamos modo "Enviar arquivo" + setInputFiles
 *      com um File sintetico. POST /api/transcribe eh mockado em mockAiEndpoints
 *      (responde "<MOCK_TRANSCRIPT>\n__DONE__\n"). Apos typewriter, aparece
 *      botao "Continuar".
 *   4. StepSections       — SOAP pre-selecionado, botao "Gerar Anamnese".
 *      POST /api/anamnesis mockado -> sections com Queixa Principal / etc.
 *   5. StepAnamnesis      — exibe sections em Textarea, botao "Finalizar
 *      Atendimento" abre AlertDialog "Finalizar atendimento" com botao
 *      "Finalizar" que chama saveConsultation (POST /api/consultations) e
 *      router.push(/consultation).
 *
 * Abandono:
 *   - Sidebar (>=md): botao "Abandonar consulta"
 *   - Mobile strip:   botao "Abandonar"
 *   - AlertDialog -> botao "Abandonar" (vermelho)
 *   - Antes de debitar credito: redirect direto sem chamar action.
 *
 * Pre-requisitos do usuario E2E:
 *   - clinic_name + cnpj + endereco + cep + phone + email preenchidos
 *     (seedClinicForUser). Sem isso a session page redireciona p/ /settings.
 *   - credits_remaining > 0 (createTestUser usa 999).
 */
test.describe('fluxo de consulta com IA mockada', () => {
  // Compilacao on-demand do Next dev + roteamento entre steps demandam folga.
  test.setTimeout(180_000)

  test('inicia consulta, percorre os 5 steps e finaliza com IA mockada', async ({ page }) => {
    await mockAiEndpoints(page)

    const user = await createTestUser({ role: 'user' })
    await seedClinicForUser(user.id)
    const patient = await createPatient(user.id, { name: `E2E_Patient_${Date.now()}` })
    await loginAsUser(page, user)

    // Vai para /consultation (lista)
    await page.goto('/consultation')
    await page.waitForLoadState('networkidle')

    // Encontra a linha do paciente e clica em "Iniciar atendimento"
    const row = page.getByRole('row').filter({ hasText: patient.name })
    await expect(row).toBeVisible({ timeout: 30_000 })
    const startBtn = row.getByRole('button', { name: /iniciar atendimento/i })
    await expect(startBtn).toBeEnabled()
    await startBtn.click()

    // ─── Step 1: Confirmar paciente ────────────────────────────────────────
    await page.waitForURL(/\/consultation\/[^/]+$/, { timeout: 30_000 })
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: /confirmar paciente/i })).toBeVisible({
      timeout: 30_000,
    })
    const confirmContinuar = page.getByRole('button', { name: /confirmar e continuar/i })
    await expect(confirmContinuar).toBeEnabled()
    await confirmContinuar.click()

    // CreditInfoModal -> "Confirmar inicio" (debita 1 credito)
    const confirmInicio = page.getByRole('button', { name: /confirmar in[ií]cio/i })
    await expect(confirmInicio).toBeVisible({ timeout: 10_000 })
    await expect(confirmInicio).toBeEnabled()
    await confirmInicio.click()

    // ─── Step 2: Autorizacao de gravacao ───────────────────────────────────
    await expect(page.getByRole('heading', { name: /autoriza[cç][aã]o de grava[cç][aã]o/i })).toBeVisible({
      timeout: 30_000,
    })
    // Checkbox de consentimento
    const consentCheckbox = page.getByRole('checkbox')
    await expect(consentCheckbox).toBeVisible()
    await consentCheckbox.click()

    const continuarConsent = page.getByRole('button', { name: /^continuar$/i })
    await expect(continuarConsent).toBeEnabled()
    await continuarConsent.click()

    // ─── Step 3: Audio (upload de arquivo sintetico, transcribe mockado) ───
    await expect(page.getByRole('heading', { name: /[áa]udio da consulta/i })).toBeVisible({
      timeout: 30_000,
    })

    // Tab "Enviar arquivo" eh o default mas garantimos
    const uploadTab = page.getByRole('tab', { name: /enviar arquivo/i })
    if (await uploadTab.isVisible().catch(() => false)) {
      await uploadTab.click()
    }

    // O input de file eh hidden (sem label). Localizamos via seletor type=file.
    // E o unico <input type="file"> da pagina nesse step.
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'e2e-mock.mp3',
      mimeType: 'audio/mpeg',
      buffer: Buffer.from('fake-audio-bytes-for-e2e-mock'),
    })

    const iniciarProc = page.getByRole('button', { name: /iniciar processamento/i })
    await expect(iniciarProc).toBeEnabled()
    await iniciarProc.click()

    // Apos transcribe mockado + typewriter, aparece botao Continuar no step 3
    const continuarAudio = page.getByRole('button', { name: /^continuar$/i })
    await expect(continuarAudio).toBeVisible({ timeout: 30_000 })
    await expect(continuarAudio).toBeEnabled()
    await continuarAudio.click()

    // ─── Step 4: Selecao de secoes -> gerar anamnese (mockado) ─────────────
    await expect(
      page.getByRole('heading', { name: /revis[aã]o e sele[cç][aã]o de se[cç][oõ]es/i }),
    ).toBeVisible({ timeout: 30_000 })

    const gerarAnamnese = page.getByRole('button', { name: /gerar anamnese/i })
    await expect(gerarAnamnese).toBeEnabled()
    await gerarAnamnese.click()

    // ─── Step 5: Anamnese estruturada exibida + finalizar ──────────────────
    // Os MOCK_SECTIONS em mocks.ts comecam com "Queixa Principal".
    await expect(page.getByText(/queixa principal/i).first()).toBeVisible({ timeout: 30_000 })
    // Conteudo mockado tambem deve aparecer em algum Textarea/region.
    await expect(page.getByText(/dor lombar/i).first()).toBeVisible()

    // Botao "Finalizar Atendimento" abre modal de confirmacao
    const finalizarAtendimento = page.getByRole('button', { name: /finalizar atendimento/i })
    await expect(finalizarAtendimento).toBeVisible()
    await expect(finalizarAtendimento).toBeEnabled()
    // Remove toasts Sonner ativos: em mobile (375px) eles ficam bottom-right
    // sobre o botao e intercepm tanto o click quanto a abertura do modal.
    await page.evaluate(() => {
      document.querySelectorAll('[data-sonner-toast]').forEach((el) => el.remove())
    })
    await finalizarAtendimento.click()

    // Modal -> botao "Finalizar"
    const confirmFinalizar = page.getByRole('button', { name: /^finalizar$/i })
    await expect(confirmFinalizar).toBeVisible({ timeout: 10_000 })
    await confirmFinalizar.click()

    // saveConsultation -> POST /api/consultations -> router.push(/consultation)
    await page.waitForURL(/\/consultation(\?|$|\/)$/, { timeout: 30_000 })
    await expect(page).toHaveURL(/\/consultation(\?|$|\/)$/)
  })

  test('abandonar consulta no step 1 (antes de debitar) volta para /consultation', async ({
    page,
  }, testInfo) => {
    await mockAiEndpoints(page)

    const user = await createTestUser({ role: 'user' })
    await seedClinicForUser(user.id)
    const patient = await createPatient(user.id, { name: `E2E_Patient_${Date.now()}_abandon` })
    await loginAsUser(page, user)

    await page.goto('/consultation')
    await page.waitForLoadState('networkidle')

    const row = page.getByRole('row').filter({ hasText: patient.name })
    await expect(row).toBeVisible({ timeout: 30_000 })
    await row.getByRole('button', { name: /iniciar atendimento/i }).click()

    await page.waitForURL(/\/consultation\/[^/]+$/, { timeout: 30_000 })
    await expect(page.getByRole('heading', { name: /confirmar paciente/i })).toBeVisible({
      timeout: 30_000,
    })

    // Abandono: em mobile o botao no strip eh "Abandonar"; em md+ eh
    // "Abandonar consulta" no sidebar. Ambos disparam o mesmo AlertDialog.
    const isMobile = testInfo.project.name === 'mobile'
    const trigger = isMobile
      ? page.getByRole('button', { name: /^abandonar$/i }).first()
      : page.getByRole('button', { name: /abandonar consulta/i }).first()
    await expect(trigger).toBeVisible()
    await expect(trigger).toBeEnabled()
    await trigger.click()

    // AlertDialog -> botao "Abandonar" (vermelho)
    const confirmar = page.getByRole('button', { name: /^abandonar$/i }).last()
    await expect(confirmar).toBeVisible({ timeout: 10_000 })
    await confirmar.click()

    // Sem credito debitado, redirect direto sem server action
    await page.waitForURL(/\/consultation(\?|$|\/)$/, { timeout: 15_000 })
    await expect(page).toHaveURL(/\/consultation(\?|$|\/)$/)
  })
})
