import { test, expect, type Page } from '@playwright/test'
import { makeE2eId } from '../../fixtures/auth'
import { getTestSupabase } from '../../fixtures/supabase'

/**
 * Solicitar acesso — descoberta de implementacao:
 *
 *  - NAO existe rota `/solicitar-acesso`. O fluxo vive em `/login?mode=solicitar`,
 *    que monta o componente `AccessRequestChat` (src/app/(auth)/login/access-request-chat.tsx).
 *  - UI eh conversacional (chat) e nao um formulario com labels. Eh um unico
 *    `<input>` (com `ref={chatInputRef}`) que recebe a resposta de cada step:
 *      step 0: name      -> "Qual é o seu nome completo?"
 *      step 1: email     -> "Prazer, {first}! Qual é o seu email?"
 *      step 2: specialty -> "Qual é a sua especialidade médica?"
 *      step 3: phone     -> "Qual é o seu WhatsApp?" (campo telefone aplica mascara)
 *      step 4: message   -> "Quer deixar alguma mensagem? (opcional)"
 *  - Apos os 5 steps abre um cartao de confirmacao com botao
 *    "Confirmar solicitação" que dispara `POST /api/requests`.
 *  - Validacoes inline (`inputError`) renderizam acima do input em <p class="text-destructive">:
 *      * Email mal formado -> "Email inválido."
 *      * Nome curto / so simbolos, etc.
 *  - Sucesso:
 *      * toast Sonner "Solicitação enviada!"
 *      * tela final com heading "Solicitação recebida!"
 *      * INSERT na tabela `access_requests` (status: "pending")
 *  - Step de email faz `GET /api/requests?email=` para checar duplicata — emails
 *    com prefixo `e2e-req-` + timestamp + viewport sao sempre unicos.
 *  - Endpoint POST `/api/requests` pode aplicar rate-limit; emails unicos por
 *    viewport evitam colisao entre as 4 execucoes paralelas.
 *
 * Locators usados:
 *  - Botao "Solicitar" (em /login) ativa o modo chat.
 *  - Input do chat: `input[placeholder]` que muda por step. Usamos o placeholder
 *    do step atual (sempre o unico input visivel dentro do chat).
 *  - Botao de avancar: pressionamos `Enter` no input (handler em `onKeyDown`),
 *    estrategia mais robusta que clicar no icone Send sem aria-label.
 *
 * `data-testid` nao adicionado: a UI ja expoe selectors estaveis (placeholders,
 * textos de pergunta unicos, botoes com texto explicito).
 */

const STEP_PLACEHOLDERS: Record<string, string> = {
  name: 'Dr. João Silva',
  email: 'seu@email.com',
  specialty: 'Clínica Geral, Cardiologia...',
  phone: '(11) 99999-9999',
  message: 'Contexto de uso, dúvidas...',
}

async function openChat(page: Page): Promise<void> {
  await page.goto('/login?mode=solicitar')
  await page.waitForLoadState('networkidle')
  // Primeira pergunta indica que o chat ja inicializou e esta interativo.
  await expect(page.getByText('Qual é o seu nome completo?')).toBeVisible({ timeout: 15_000 })
}

/**
 * Localiza o input do chat pelo placeholder do step atual.
 * O placeholder do step opcional `message` inclui sufixo "(opcional — Enter para pular)".
 */
function chatInput(page: Page, stepKey: keyof typeof STEP_PLACEHOLDERS) {
  const placeholder = STEP_PLACEHOLDERS[stepKey]
  return page.locator(`input[placeholder*=${JSON.stringify(placeholder)}]`)
}

async function answerStep(
  page: Page,
  stepKey: keyof typeof STEP_PLACEHOLDERS,
  value: string,
): Promise<void> {
  const input = chatInput(page, stepKey)
  await expect(input).toBeVisible()
  await expect(input).toBeEnabled()
  await input.fill(value)
  await input.press('Enter')
}

test.describe('solicitar acesso (login?mode=solicitar)', () => {
  // Cada step do chat tem `setTimeout` de 300-900ms para simular digitacao do bot.
  // Em 4 viewports paralelos o tempo total se acumula — elevamos o timeout do
  // teste para evitar flake sem usar waitForTimeout.
  test.setTimeout(90_000)

  test('cria access_request com sucesso e persiste no banco', async ({ page }, testInfo) => {
    const uniqueId = makeE2eId(`e2e-req-${testInfo.project.name}`)
    const email = `${uniqueId}@test.com`
    // Validador `validators.name` aceita apenas letras + espacos (sem hifens/numeros).
    // Por isso o nome eh fixo "Teste Automatizado E E"; a unicidade vai no email.
    const name = 'Teste Automatizado'
    const specialty = 'Clinica Geral'
    const phone = '11999990000'
    const message = `Mensagem E2E ${testInfo.project.name}`

    await openChat(page)

    await answerStep(page, 'name', name)
    // Bot saudacao usa o primeiro nome do usuario; aguardamos a proxima pergunta
    // para garantir que o step avancou antes de digitar o proximo.
    await expect(page.getByText(/Qual é o seu email\?/)).toBeVisible({ timeout: 10_000 })

    await answerStep(page, 'email', email)
    await expect(page.getByText('Qual é a sua especialidade médica?')).toBeVisible({
      timeout: 10_000,
    })

    await answerStep(page, 'specialty', specialty)
    await expect(page.getByText('Qual é o seu WhatsApp?')).toBeVisible({ timeout: 10_000 })

    await answerStep(page, 'phone', phone)
    await expect(page.getByText(/Quer deixar alguma mensagem\?/)).toBeVisible({ timeout: 10_000 })

    await answerStep(page, 'message', message)

    // Cartao de confirmacao aparece apos o ultimo step + delay de ~1.6s.
    const confirmBtn = page.getByRole('button', { name: /confirmar solicitação/i })
    await expect(confirmBtn).toBeVisible({ timeout: 15_000 })

    // Captura a chamada POST para validar status sem depender so do toast.
    const postResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/requests') && resp.request().method() === 'POST',
      { timeout: 30_000 },
    )
    await confirmBtn.click()
    const response = await postResponse
    expect(response.status()).toBe(201)

    // Tela final de sucesso.
    await expect(
      page.getByRole('heading', { name: /solicitação recebida!/i }),
    ).toBeVisible({ timeout: 15_000 })

    // Confirma INSERT no banco de teste.
    const supabase = getTestSupabase()
    const { data, error } = await supabase
      .from('access_requests')
      .select('id, email, name, specialty, phone, status')
      .eq('email', email)
      .single()
    expect(error).toBeNull()
    expect(data?.status).toBe('pending')
    expect(data?.name).toBe(name)
    expect(data?.specialty).toBe(specialty)
  })

  test('email mal formado dispara erro inline "Email inválido."', async ({ page }, testInfo) => {
    const uniqueId = makeE2eId(`e2e-req-invalid-${testInfo.project.name}`)
    // Validador `validators.name` aceita apenas letras + espacos (sem hifens/numeros).
    // Por isso o nome eh fixo "Teste Automatizado E E"; a unicidade vai no email.
    const name = 'Teste Automatizado'

    await openChat(page)

    // Passa pelo step de nome para chegar no step de email.
    await answerStep(page, 'name', name)
    await expect(page.getByText(/Qual é o seu email\?/)).toBeVisible({ timeout: 10_000 })

    // Envia um email mal formado — o validador `validators.email` rejeita.
    await answerStep(page, 'email', 'nao-eh-email')

    // `inputError` renderiza acima do input com classe `text-destructive`.
    await expect(page.getByText('Email inválido.')).toBeVisible({ timeout: 5_000 })

    // O passo nao avancou: a pergunta de email continua visivel.
    await expect(page.getByText(/Qual é o seu email\?/)).toBeVisible()
  })
})
