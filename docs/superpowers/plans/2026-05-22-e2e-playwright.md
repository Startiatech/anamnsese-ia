# Suite E2E Playwright — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar suite E2E completa com Playwright cobrindo landing, login, app do usuario profissional e console master nos 4 viewports (mobile/tablet/laptop/desktop).

**Architecture:** Playwright `@playwright/test` em pasta `e2e/`, 4 projects de viewport, fixtures customizadas para auth/seed/mocks, dados isolados via prefixo `e2e-`, guard rail contra producao via whitelist de ref do banco. Servidor Next sobe via `webServer` da config.

**Tech Stack:** TypeScript, `@playwright/test`, `bcryptjs` (ja instalado), Supabase client (ja instalado).

**Spec base:** `docs/superpowers/specs/2026-05-22-e2e-playwright-design.md`

**Banco alvo (whitelist):** `anamnese-ia-com-claude-code--teste` — ref `nnmpucgxehzvcliglayr`

---

## File Structure

### Criados
- `.claude/agents/e2e-playwright-reviewer.md` — agente especialista
- `playwright.config.ts` — config raiz (4 viewports, webServer, baseURL)
- `e2e/global-setup.ts` — validacao anti-producao
- `e2e/global-teardown.ts` — cleanup final
- `e2e/fixtures/supabase.ts` — cliente Supabase service_role para fixtures
- `e2e/fixtures/auth.ts` — login + criacao de usuarios
- `e2e/fixtures/seed.ts` — criacao/limpeza de dados
- `e2e/fixtures/mocks.ts` — mocks de endpoints de IA
- `e2e/fixtures/test-base.ts` — base do `test()` com fixtures
- `e2e/specs/public/landing.spec.ts`
- `e2e/specs/public/login.spec.ts`
- `e2e/specs/public/request-access.spec.ts`
- `e2e/specs/app/dashboard.spec.ts`
- `e2e/specs/app/patients.spec.ts`
- `e2e/specs/app/consultation.spec.ts`
- `e2e/specs/app/settings.spec.ts`
- `e2e/specs/console/users.spec.ts`
- `e2e/specs/console/access-requests.spec.ts`
- `e2e/specs/console/feedbacks.spec.ts`
- `e2e/README.md`

### Modificados
- `package.json` — scripts `test:e2e*`
- `CLAUDE.md` — referencia ao novo agente
- `docs/architecture.md` — diagrama da camada E2E
- `.gitignore` — `playwright-report/`, `test-results/`, `.playwright-cache/`

---

## ⚠️ Padrao critico de selectors (leia antes de implementar specs)

Os specs abaixo trazem **scaffold com locators baseados em convencoes do projeto** (shadcn/ui, labels em pt-br). Durante a execucao de cada task de spec, o agente DEVE:

1. Ler o componente/pagina alvo (`src/app/**` ou `src/components/**`) antes de finalizar selectors
2. Rodar o spec uma primeira vez para ver quais locators falham
3. Ajustar para `getByRole`/`getByLabel` reais, ou adicionar `data-testid` no codigo fonte quando necessario
4. Commitar `data-testid` adicionados junto com o spec correspondente

Selectors com `data-testid` devem ser nomeados em kebab-case e descritivos: `patient-create-button`, `consultation-step-3`, `user-row-${id}`.

---

# Fase 1 — Fundacao

## Task 1: Instalar Playwright e scripts npm

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Instalar Playwright como dev dependency**

```bash
pnpm add -D @playwright/test
```

- [ ] **Step 2: Instalar browser Chromium (unico necessario para MVP)**

```bash
pnpm exec playwright install chromium
```

Expected: download de ~100MB, mensagem "Chromium 1XX downloaded".

- [ ] **Step 3: Adicionar scripts em `package.json`**

Localizar o bloco `"scripts"` e adicionar:

```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui",
"test:e2e:headed": "playwright test --headed",
"test:e2e:report": "playwright show-report"
```

- [ ] **Step 4: Atualizar `.gitignore`**

Adicionar ao final do `.gitignore`:

```
# playwright
/playwright-report/
/test-results/
/.playwright-cache/
/playwright/.cache/
```

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml .gitignore
git commit -m "chore(e2e): instala Playwright e configura scripts npm"
```

---

## Task 2: Criar agente especialista `e2e-playwright-reviewer`

**Files:**
- Create: `.claude/agents/e2e-playwright-reviewer.md`

- [ ] **Step 1: Criar o agente**

Criar `.claude/agents/e2e-playwright-reviewer.md` com conteudo:

```markdown
---
name: e2e-playwright-reviewer
description: Especialista em Playwright e testes E2E do Anamnese IA. Use ao criar ou editar specs em `e2e/`, fixtures de auth/seed/mocks, ou qualquer config Playwright. Revisa locators, esperas, isolamento de dados, viewports, mocks de IA e flakiness.
tools: Read, Grep, Glob
---

Voce e o especialista em testes E2E com Playwright do Anamnese IA. Sua funcao e revisar specs antes do merge, garantindo qualidade, robustez e ausencia de flakiness.

## Verificacoes obrigatorias

### 1. Locators robustos
- Prefere `getByRole`, `getByLabel`, `getByTestId`, `getByText` nesta ordem
- Reprova seletores CSS frageis: `.btn-primary`, `div > div:nth-child(2)`, `#root .form input`
- Se um locator nao tem alternativa semantica, exige `data-testid` no codigo fonte

### 2. Esperas corretas
- Aceita: `await expect(locator).toBeVisible()`, `await page.waitForURL()`, `await expect(locator).toHaveText()`
- Reprova: `page.waitForTimeout(...)`, `setTimeout`, esperas fixas
- Verifica que asserções usam `await expect(...)` (auto-retry), nao `expect(await ...)`

### 3. Isolamento de dados
- Todo dado criado pelo teste deve ter prefixo `e2e-` (ex: `e2e-${Date.now()}@test.com`)
- Nenhum teste depende de dados de outro teste
- Cleanup roda apenas no `globalTeardown` (nao polui setup/teardown por arquivo)

### 4. Seguranca anti-producao
- Confirma que `global-setup.ts` valida ref do banco contra whitelist
- Verifica que nao ha URLs ou chaves de producao hardcoded em specs
- Em PRs novos, confere que `.env.test` continua sendo o unico source de credenciais

### 5. Asserções significativas
- Cada teste tem ao menos uma asserção que validaria comportamento real (nao so "pagina carregou")
- Reprova: `expect(page).toHaveURL('/dashboard')` como unica asserção pos-acao complexa

### 6. Viewport-aware
- Se UI muda entre viewports (sidebar vs drawer mobile, AppSheet fullscreen mobile), spec testa o comportamento por viewport via `test.info().project.name`

### 7. Mocks de IA
- Specs em `e2e/specs/app/consultation.spec.ts` DEVEM mockar `/api/transcription`, `/api/anamnesis`, `/api/refine` via `page.route()` ou fixture compartilhada
- Sem mock, reprova: chamadas reais sao lentas, caras e flaky

### 8. Parallelism-safe
- Nenhum teste muta dados globais que outro teste leu (ex: configuracoes de sistema)
- Email/CPF/nomes unicos por teste

## O que NAO verificar
- Cobertura de lógica pura (responsabilidade do `@tdd-guide`)
- Visual pixel-perfect (responsabilidade do `@ui-reviewer`)
- Seguranca de endpoints (responsabilidade do `@security-reviewer`)

## Saida esperada
- Lista numerada de problemas encontrados, cada um com:
  - Arquivo e linha
  - Categoria (locator/espera/isolamento/seguranca/etc)
  - Sugestao concreta de fix com codigo
- Se nada encontrado: "Spec aprovado, sem ressalvas".
```

- [ ] **Step 2: Commit**

```bash
git add .claude/agents/e2e-playwright-reviewer.md
git commit -m "feat(agents): adiciona agente e2e-playwright-reviewer"
```

---

## Task 3: Criar `playwright.config.ts`

**Files:**
- Create: `playwright.config.ts`

- [ ] **Step 1: Criar o config**

Criar `playwright.config.ts` na raiz:

```typescript
import { defineConfig, devices } from '@playwright/test'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.test' })

const PORT = 3000
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e/specs',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 4,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: 'mobile',
      use: { ...devices['iPhone SE'], viewport: { width: 375, height: 667 } },
    },
    {
      name: 'tablet',
      use: { ...devices['iPad (gen 7)'], viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'laptop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: BASE_URL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
```

- [ ] **Step 2: Verificar que `dotenv` esta instalado**

```bash
node -e "require('dotenv')" 2>&1 || pnpm add -D dotenv
```

- [ ] **Step 3: Commit**

```bash
git add playwright.config.ts package.json pnpm-lock.yaml
git commit -m "feat(e2e): adiciona playwright.config.ts com 4 viewports e webServer"
```

---

## Task 4: Criar `e2e/global-setup.ts` (guard rail anti-producao)

**Files:**
- Create: `e2e/global-setup.ts`

- [ ] **Step 1: Criar o setup**

```typescript
import { config as loadEnv } from 'dotenv'

const TEST_PROJECT_REF = 'nnmpucgxehzvcliglayr'

async function globalSetup() {
  loadEnv({ path: '.env.test' })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !anon || !serviceRole) {
    throw new Error(
      'E2E abortado: variaveis ausentes no .env.test (NEXT_PUBLIC_SUPABASE_URL, ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY).'
    )
  }

  if (!url.includes(TEST_PROJECT_REF)) {
    throw new Error(
      `E2E abortado: NEXT_PUBLIC_SUPABASE_URL nao aponta para o projeto de teste ` +
        `(esperado ref "${TEST_PROJECT_REF}", recebido "${url}"). ` +
        `E2E nunca pode rodar contra producao.`
    )
  }

  console.log('[e2e] guard rail ok — apontando para banco de teste')
}

export default globalSetup
```

- [ ] **Step 2: Rodar para validar**

```bash
pnpm exec playwright test --list 2>&1 | head -20
```

Expected: lista vazia de testes (ainda nao temos specs), sem erro do guard rail.

- [ ] **Step 3: Validar que o guard rail dispara**

Temporariamente edita `e2e/global-setup.ts` mudando `TEST_PROJECT_REF` para `'xxx'`, roda:

```bash
pnpm exec playwright test --list
```

Expected: erro `E2E abortado: NEXT_PUBLIC_SUPABASE_URL nao aponta...`. Reverter mudanca.

- [ ] **Step 4: Commit**

```bash
git add e2e/global-setup.ts
git commit -m "feat(e2e): adiciona guard rail anti-producao em global-setup"
```

---

## Task 5: Criar cliente Supabase para fixtures

**Files:**
- Create: `e2e/fixtures/supabase.ts`

- [ ] **Step 1: Criar cliente service_role isolado para testes**

```typescript
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null = null

export function getTestSupabase(): SupabaseClient {
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('[e2e] supabase fixture: variaveis ausentes')
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}
```

- [ ] **Step 2: Commit**

```bash
git add e2e/fixtures/supabase.ts
git commit -m "feat(e2e): adiciona cliente Supabase service_role para fixtures"
```

---

## Task 6: Criar fixture `auth.ts`

**Files:**
- Create: `e2e/fixtures/auth.ts`

- [ ] **Step 1: Inspecionar a rota de login**

Antes de escrever, ler `src/app/(auth)/login/page.tsx` (ou caminho equivalente) e identificar:
- URL de login (provavel `/login`)
- Labels dos inputs (provavel "Email"/"Senha")
- Texto do botao submit (provavel "Entrar")
- URL de redirect pos-login (provavel `/dashboard` para users, `/console` para masters)

Anotar os achados em comentarios do arquivo `auth.ts`.

- [ ] **Step 2: Criar o helper**

```typescript
import type { Page } from '@playwright/test'
import bcrypt from 'bcryptjs'
import { getTestSupabase } from './supabase'

export const E2E_DEFAULT_PASSWORD = 'E2eTest!2026'
export const MASTER_EMAIL = 'projectanamneseai2026@gmail.com'
export const MASTER_PASSWORD = 'anamnese-ia-claude-code@adm-master'

export interface E2eUser {
  id: string
  email: string
  password: string
  role: 'user' | 'admin' | 'master'
}

export function makeE2eId(prefix = 'e2e'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export async function createTestUser(opts?: {
  role?: 'user' | 'admin' | 'master'
  planId?: string | null
  onboarded?: boolean
}): Promise<E2eUser> {
  const role = opts?.role ?? 'user'
  const planId = opts?.planId === undefined ? null : opts.planId
  const onboarded = opts?.onboarded ?? true

  const uniqueId = makeE2eId()
  const email = `${uniqueId}@test.com`
  const passwordHash = await bcrypt.hash(E2E_DEFAULT_PASSWORD, 12)

  const supabase = getTestSupabase()
  const { data, error } = await supabase
    .from('users')
    .insert({
      name: `E2E ${uniqueId}`,
      email,
      password_hash: passwordHash,
      role,
      plan_id: planId,
      plan_selected: true,
      onboarding_completed: onboarded,
      password_is_temp: false,
      credits_remaining: 999,
      blocked: false,
    })
    .select('id, email, role')
    .single()

  if (error || !data) {
    throw new Error(`[e2e] createTestUser falhou: ${error?.message}`)
  }

  return { id: data.id, email: data.email, password: E2E_DEFAULT_PASSWORD, role: data.role as E2eUser['role'] }
}

export async function loginViaUI(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/senha/i).fill(password)
  await page.getByRole('button', { name: /entrar/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 10_000 })
}

export async function loginAsMaster(page: Page): Promise<void> {
  await loginViaUI(page, MASTER_EMAIL, MASTER_PASSWORD)
}

export async function loginAsUser(page: Page, user: E2eUser): Promise<void> {
  await loginViaUI(page, user.email, user.password)
}
```

- [ ] **Step 3: Commit**

```bash
git add e2e/fixtures/auth.ts
git commit -m "feat(e2e): adiciona fixture de autenticacao (createTestUser, loginAs*)"
```

---

## Task 7: Criar fixture `seed.ts`

**Files:**
- Create: `e2e/fixtures/seed.ts`

- [ ] **Step 1: Criar funcoes de seed e cleanup**

```typescript
import { getTestSupabase } from './supabase'
import { makeE2eId } from './auth'

export interface E2ePatient {
  id: string
  userId: string
  name: string
  cpf: string
}

function generateCpf(): string {
  // CPF aleatorio NAO validado (banco nao valida digitos)
  const n = () => Math.floor(Math.random() * 10).toString()
  return Array.from({ length: 11 }, n).join('')
}

export async function createPatient(userId: string, overrides?: Partial<E2ePatient>): Promise<E2ePatient> {
  const id = makeE2eId('e2e-pat')
  const name = overrides?.name ?? `E2E_Patient_${id}`
  const cpf = overrides?.cpf ?? generateCpf()

  const supabase = getTestSupabase()
  const { data, error } = await supabase
    .from('patients')
    .insert({ user_id: userId, name, cpf })
    .select('id, user_id, name, cpf')
    .single()

  if (error || !data) {
    throw new Error(`[e2e] createPatient falhou: ${error?.message}`)
  }

  return { id: data.id, userId: data.user_id, name: data.name, cpf: data.cpf }
}

export async function createAccessRequest(): Promise<{ id: string; email: string }> {
  const uniqueId = makeE2eId('e2e-req')
  const email = `${uniqueId}@test.com`
  const supabase = getTestSupabase()
  const { data, error } = await supabase
    .from('access_requests')
    .insert({
      name: `E2E ${uniqueId}`,
      email,
      specialty: 'Clinico Geral',
      phone: '11999990000',
      message: 'Teste E2E',
      status: 'pending',
    })
    .select('id, email')
    .single()

  if (error || !data) {
    throw new Error(`[e2e] createAccessRequest falhou: ${error?.message}`)
  }

  return { id: data.id, email: data.email }
}

export async function cleanupE2eData(): Promise<void> {
  const supabase = getTestSupabase()

  const { data: users } = await supabase
    .from('users')
    .select('id')
    .like('email', 'e2e-%@test.com')

  const ids = (users ?? []).map((u) => u.id)

  if (ids.length > 0) {
    await supabase.from('api_usage_log').delete().in('user_id', ids)
    await supabase.from('consultations').delete().in('user_id', ids)
    await supabase.from('patients').delete().in('user_id', ids)
    await supabase.from('feedbacks').delete().in('user_id', ids)
    await supabase.from('users').delete().in('id', ids)
  }

  await supabase.from('access_requests').delete().like('email', 'e2e-%@test.com')
  await supabase.from('plan_interest').delete().like('email', 'e2e-%@test.com')

  console.log(`[e2e] cleanup: ${ids.length} usuarios removidos + dados associados`)
}
```

- [ ] **Step 2: Commit**

```bash
git add e2e/fixtures/seed.ts
git commit -m "feat(e2e): adiciona fixture de seed (paciente, access request, cleanup)"
```

---

## Task 8: Criar fixture `mocks.ts` (IA mockada)

**Files:**
- Create: `e2e/fixtures/mocks.ts`

- [ ] **Step 1: Inspecionar APIs reais**

Antes de mockar, ler:
- `src/app/api/transcription/route.ts` (ou caminho real)
- `src/app/api/anamnesis/route.ts`
- `src/app/api/refine/route.ts`

Identificar shape de request/response esperado.

- [ ] **Step 2: Criar mocks**

```typescript
import type { Page } from '@playwright/test'

const MOCK_TRANSCRIPT = 'Paciente refere dor lombar ha 3 dias, sem irradiacao. Nega febre.'

const MOCK_ANAMNESIS = {
  queixa_principal: 'Dor lombar',
  historia_doenca_atual: 'Iniciada ha 3 dias, sem irradiacao, sem febre.',
  antecedentes: 'Negativo',
  exame_fisico: 'Sem alteracoes relevantes',
  hipotese_diagnostica: 'Lombalgia mecanica',
  conduta: 'Repouso relativo, analgesico, reavaliacao em 7 dias',
}

export async function mockAiEndpoints(page: Page): Promise<void> {
  await page.route('**/api/transcription', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ text: MOCK_TRANSCRIPT, model: 'mock' }),
    })
  })

  await page.route('**/api/anamnesis', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ anamnesis: MOCK_ANAMNESIS, model: 'mock' }),
    })
  })

  await page.route('**/api/refine', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ anamnesis: MOCK_ANAMNESIS, model: 'mock' }),
    })
  })
}
```

**Atencao:** Ajustar shapes de `MOCK_TRANSCRIPT` e `MOCK_ANAMNESIS` para casar com o que as APIs reais retornam (passo 1).

- [ ] **Step 3: Commit**

```bash
git add e2e/fixtures/mocks.ts
git commit -m "feat(e2e): adiciona mocks dos endpoints de IA (transcription, anamnesis, refine)"
```

---

## Task 9: Criar `e2e/global-teardown.ts`

**Files:**
- Create: `e2e/global-teardown.ts`

- [ ] **Step 1: Criar teardown**

```typescript
import { config as loadEnv } from 'dotenv'
import { cleanupE2eData } from './fixtures/seed'

async function globalTeardown() {
  loadEnv({ path: '.env.test' })
  try {
    await cleanupE2eData()
  } catch (err) {
    console.error('[e2e] teardown falhou:', err)
  }
}

export default globalTeardown
```

- [ ] **Step 2: Commit**

```bash
git add e2e/global-teardown.ts
git commit -m "feat(e2e): adiciona global teardown com cleanup de dados e2e-"
```

---

## Task 10: Criar `e2e/README.md`

**Files:**
- Create: `e2e/README.md`

- [ ] **Step 1: Criar documentacao**

```markdown
# E2E Tests — Playwright

Suite end-to-end do Anamnese IA. Cobre LP, login, app do usuario profissional e console master nos 4 viewports.

## Pre-requisitos

- `.env.test` preenchido com chaves do projeto `anamnese-ia-com-claude-code--teste`
- Usuario master fixo existente: `projectanamneseai2026@gmail.com`
- Dependencias instaladas: `pnpm install` + `pnpm exec playwright install chromium`

## Comandos

| Comando | Uso |
| --- | --- |
| `pnpm test:e2e` | Roda suite completa |
| `pnpm test:e2e --project=mobile` | So mobile (375x667) |
| `pnpm test:e2e:ui` | Modo interativo (debug visual) |
| `pnpm test:e2e:headed` | Roda vendo o navegador |
| `pnpm test:e2e:report` | Abre relatorio HTML pos-run |

## Estrutura

```
e2e/
├── global-setup.ts       # validacao anti-producao
├── global-teardown.ts    # cleanup final
├── fixtures/             # auth, seed, mocks, supabase client
└── specs/
    ├── public/           # landing, login, request access
    ├── app/              # dashboard, patients, consultation, settings
    └── console/          # users, access-requests, feedbacks
```

## Padroes obrigatorios

- **Locators:** `getByRole` > `getByLabel` > `getByTestId` > `getByText`. Sem CSS frageis.
- **Esperas:** `await expect(...).toBeVisible()`. Nunca `waitForTimeout`.
- **Dados:** todo registro criado tem prefixo `e2e-`. Cleanup automatico no final.
- **IA:** specs de consulta DEVEM usar `mockAiEndpoints(page)` antes de iniciar fluxo.
- **Viewport:** se UI muda entre tamanhos, asserções condicionais por `test.info().project.name`.

## Troubleshooting

| Sintoma | Causa provavel |
| --- | --- |
| `E2E abortado: NEXT_PUBLIC_SUPABASE_URL...` | `.env.test` apontando para projeto errado |
| Timeout 30s no login | dev server nao subiu (verifique porta 3000) |
| Locator nao encontrado | UI mudou — atualizar spec ou adicionar `data-testid` |
| Banco com lixo `e2e-*` | Suite cancelada antes do teardown — roda `pnpm test:e2e` que limpa, ou SQL manual |

## Limpeza manual (banco de teste)

Se algum teste deixou lixo:

```sql
DELETE FROM users WHERE email LIKE 'e2e-%@test.com';
-- demais tabelas cascateiam por FK ou via cleanupE2eData()
```

## Agente revisor

PRs com mudancas em `e2e/` devem passar pelo agente `@e2e-playwright-reviewer`.
```

- [ ] **Step 2: Commit**

```bash
git add e2e/README.md
git commit -m "docs(e2e): adiciona README com padroes e troubleshooting"
```

---

## Task 11: Smoke run da fundacao (sem specs ainda)

- [ ] **Step 1: Rodar lista de testes**

```bash
pnpm test:e2e --list
```

Expected: "Total: 0 tests in 0 files." sem erros. Confirma que config, setup e teardown estao validos.

- [ ] **Step 2: Rodar suite vazia (testa que webServer sobe)**

```bash
pnpm test:e2e
```

Expected:
- Mensagem `[e2e] guard rail ok`
- webServer sobe `pnpm dev`
- Mensagem `[e2e] cleanup: 0 usuarios removidos...`
- Exit 0

Se algo falhar, parar e debugar antes de seguir.

---

# Fase 2 — Specs publicas

## Task 12: Spec `landing.spec.ts`

**Files:**
- Create: `e2e/specs/public/landing.spec.ts`

- [ ] **Step 1: Inspecionar a landing page**

Ler `src/app/(marketing)/page.tsx` (ou caminho equivalente). Anotar:
- Headings principais (h1, h2)
- CTAs visiveis (textos exatos)
- Links de navegacao no header
- Footer (existe? que conteudo?)

- [ ] **Step 2: Escrever o spec**

```typescript
import { test, expect } from '@playwright/test'

test.describe('landing page', () => {
  test('exibe hero, CTAs e footer', async ({ page }) => {
    await page.goto('/')

    // Hero — ajustar texto exato apos inspecao
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // CTA principal — ajustar texto apos inspecao
    const ctaPrincipal = page.getByRole('link', { name: /solicitar acesso|comecar/i }).first()
    await expect(ctaPrincipal).toBeVisible()

    // Footer presente
    await expect(page.locator('footer')).toBeVisible()
  })

  test('CTA de solicitar acesso navega para o formulario', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /solicitar acesso/i }).first().click()
    await page.waitForURL(/.*\/(request-access|acesso|solicitar).*/, { timeout: 5_000 })
    await expect(page.getByRole('heading', { name: /solicitar acesso|pedir acesso/i })).toBeVisible()
  })

  test('link de login navega para /login', async ({ page }) => {
    await page.goto('/')
    const loginLink = page.getByRole('link', { name: /entrar|login/i }).first()
    await loginLink.click()
    await page.waitForURL(/.*\/login.*/, { timeout: 5_000 })
  })
})
```

- [ ] **Step 3: Rodar e ajustar selectors**

```bash
pnpm test:e2e e2e/specs/public/landing.spec.ts --project=desktop
```

Para cada falha de locator, ler o componente real, ajustar selector ou adicionar `data-testid`. Re-rodar ate verde.

- [ ] **Step 4: Validar nos 4 viewports**

```bash
pnpm test:e2e e2e/specs/public/landing.spec.ts
```

Expected: 12 testes (3 × 4 viewports) passando.

- [ ] **Step 5: Commit**

```bash
git add e2e/specs/public/landing.spec.ts src/app
git commit -m "test(e2e): adiciona spec da landing page"
```

---

## Task 13: Spec `login.spec.ts`

**Files:**
- Create: `e2e/specs/public/login.spec.ts`

- [ ] **Step 1: Inspecionar `/login`**

Ler `src/app/(auth)/login/page.tsx` e componente do form. Anotar labels, mensagens de erro, validacoes Zod.

- [ ] **Step 2: Escrever o spec**

```typescript
import { test, expect } from '@playwright/test'
import { MASTER_EMAIL, MASTER_PASSWORD, createTestUser, E2E_DEFAULT_PASSWORD } from '../../fixtures/auth'

test.describe('login', () => {
  test('master loga com sucesso e e redirecionado para console', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(MASTER_EMAIL)
    await page.getByLabel(/senha/i).fill(MASTER_PASSWORD)
    await page.getByRole('button', { name: /entrar/i }).click()
    await page.waitForURL(/.*\/(console|admin|dashboard).*/, { timeout: 10_000 })
    await expect(page.getByText(/leojosants|master/i).first()).toBeVisible()
  })

  test('usuario profissional loga e cai no dashboard', async ({ page }) => {
    const user = await createTestUser({ role: 'user' })
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(user.email)
    await page.getByLabel(/senha/i).fill(E2E_DEFAULT_PASSWORD)
    await page.getByRole('button', { name: /entrar/i }).click()
    await page.waitForURL(/.*\/dashboard.*/, { timeout: 10_000 })
  })

  test('senha errada exibe mensagem de erro', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(MASTER_EMAIL)
    await page.getByLabel(/senha/i).fill('senha-errada-123')
    await page.getByRole('button', { name: /entrar/i }).click()
    await expect(page.getByText(/credenciais|invalid|incorreto/i)).toBeVisible()
    await expect(page).toHaveURL(/.*\/login.*/)
  })

  test('validacao Zod bloqueia email invalido', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/email/i).fill('nao-e-email')
    await page.getByLabel(/senha/i).fill('qualquersenha')
    await page.getByRole('button', { name: /entrar/i }).click()
    await expect(page.getByText(/email.*invalido|invalid email/i)).toBeVisible()
  })

  test('campos vazios bloqueiam submit', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: /entrar/i }).click()
    await expect(page.getByText(/obrigatorio|required/i).first()).toBeVisible()
  })
})
```

- [ ] **Step 3: Rodar e ajustar**

```bash
pnpm test:e2e e2e/specs/public/login.spec.ts
```

Iterar ate todos os 20 testes (5 × 4 viewports) passarem.

- [ ] **Step 4: Commit**

```bash
git add e2e/specs/public/login.spec.ts src/app src/components
git commit -m "test(e2e): adiciona spec de login (sucesso, falha, validacoes)"
```

---

## Task 14: Spec `request-access.spec.ts`

**Files:**
- Create: `e2e/specs/public/request-access.spec.ts`

- [ ] **Step 1: Inspecionar pagina de solicitar acesso**

Ler `src/app/(marketing)/solicitar-acesso/page.tsx` (ou caminho real). Anotar campos do form, schema Zod (`src/lib/schemas.ts`).

- [ ] **Step 2: Escrever o spec**

```typescript
import { test, expect } from '@playwright/test'
import { makeE2eId } from '../../fixtures/auth'
import { getTestSupabase } from '../../fixtures/supabase'

test.describe('solicitar acesso', () => {
  test('cria access_request com sucesso', async ({ page }) => {
    const uniqueId = makeE2eId('e2e-req')
    const email = `${uniqueId}@test.com`

    await page.goto('/solicitar-acesso')
    await page.getByLabel(/nome/i).fill(`E2E ${uniqueId}`)
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/especialidade/i).fill('Clinico Geral')
    await page.getByLabel(/telefone|celular/i).fill('11999990000')
    await page.getByLabel(/mensagem/i).fill('Mensagem de teste E2E')
    await page.getByRole('button', { name: /enviar|solicitar/i }).click()

    await expect(page.getByText(/sucesso|recebemos|obrigado/i)).toBeVisible({ timeout: 10_000 })

    // Confirma no banco
    const supabase = getTestSupabase()
    const { data } = await supabase
      .from('access_requests')
      .select('id, email, status')
      .eq('email', email)
      .single()
    expect(data?.status).toBe('pending')
  })

  test('email invalido bloqueia submit', async ({ page }) => {
    await page.goto('/solicitar-acesso')
    await page.getByLabel(/nome/i).fill('Teste')
    await page.getByLabel(/email/i).fill('email-invalido')
    await page.getByLabel(/especialidade/i).fill('X')
    await page.getByLabel(/telefone|celular/i).fill('11999990000')
    await page.getByRole('button', { name: /enviar|solicitar/i }).click()
    await expect(page.getByText(/email.*invalido|invalid email/i)).toBeVisible()
  })
})
```

- [ ] **Step 3: Rodar e ajustar**

```bash
pnpm test:e2e e2e/specs/public/request-access.spec.ts
```

- [ ] **Step 4: Commit**

```bash
git add e2e/specs/public/request-access.spec.ts src/app
git commit -m "test(e2e): adiciona spec de solicitar acesso"
```

---

# Fase 3 — Specs do app (usuario profissional)

## Task 15: Spec `dashboard.spec.ts`

**Files:**
- Create: `e2e/specs/app/dashboard.spec.ts`

- [ ] **Step 1: Inspecionar `/dashboard`, `Sidebar`, `Topbar`, `MobileSidebar`**

Anotar:
- Elementos do dashboard (créditos exibidos? nome? avatar?)
- Estrutura responsiva: sidebar vs drawer mobile

- [ ] **Step 2: Escrever spec**

```typescript
import { test, expect } from '@playwright/test'
import { createTestUser, loginAsUser } from '../../fixtures/auth'

test.describe('dashboard do usuario', () => {
  test('exibe nome, creditos e navegacao', async ({ page }) => {
    const user = await createTestUser({ role: 'user' })
    await loginAsUser(page, user)

    await page.waitForURL(/.*\/dashboard.*/)
    await expect(page.getByText(user.email).or(page.getByText(/E2E /))).toBeVisible()
    await expect(page.getByText(/999|creditos|saldo/i)).toBeVisible()
  })

  test('sidebar (desktop/laptop) ou drawer (mobile/tablet) abre navegacao', async ({ page }, testInfo) => {
    const user = await createTestUser({ role: 'user' })
    await loginAsUser(page, user)

    const isMobile = testInfo.project.name === 'mobile' || testInfo.project.name === 'tablet'

    if (isMobile) {
      const toggle = page.getByRole('button', { name: /menu|abrir/i })
      await toggle.click()
    }

    await expect(page.getByRole('link', { name: /pacientes/i })).toBeVisible()
  })
})
```

- [ ] **Step 3: Rodar, ajustar, commit**

```bash
pnpm test:e2e e2e/specs/app/dashboard.spec.ts
git add e2e/specs/app/dashboard.spec.ts src
git commit -m "test(e2e): adiciona spec do dashboard do usuario"
```

---

## Task 16: Spec `patients.spec.ts`

**Files:**
- Create: `e2e/specs/app/patients.spec.ts`

- [ ] **Step 1: Inspecionar `/pacientes`, componente `AppSheet` de criacao**

Anotar campos, validacoes (CPF), botoes.

- [ ] **Step 2: Escrever spec**

```typescript
import { test, expect } from '@playwright/test'
import { createTestUser, loginAsUser } from '../../fixtures/auth'
import { createPatient } from '../../fixtures/seed'

test.describe('pacientes — usuario', () => {
  test('lista vazia exibe estado vazio', async ({ page }) => {
    const user = await createTestUser({ role: 'user' })
    await loginAsUser(page, user)
    await page.goto('/pacientes')
    await expect(page.getByText(/nenhum paciente|vazio|adicionar primeiro/i)).toBeVisible()
  })

  test('lista exibe paciente seedado', async ({ page }) => {
    const user = await createTestUser({ role: 'user' })
    const patient = await createPatient(user.id)
    await loginAsUser(page, user)
    await page.goto('/pacientes')
    await expect(page.getByText(patient.name)).toBeVisible()
  })

  test('criar paciente via AppSheet', async ({ page }) => {
    const user = await createTestUser({ role: 'user' })
    await loginAsUser(page, user)
    await page.goto('/pacientes')

    await page.getByRole('button', { name: /novo paciente|adicionar/i }).click()
    await expect(page.getByRole('dialog').or(page.locator('[role="dialog"]'))).toBeVisible()

    const nome = `E2E_Patient_${Date.now()}`
    await page.getByLabel(/nome/i).fill(nome)
    await page.getByLabel(/cpf/i).fill('12345678901')
    await page.getByRole('button', { name: /salvar|criar/i }).click()

    await expect(page.getByText(nome)).toBeVisible({ timeout: 10_000 })
  })

  test('CPF invalido bloqueia submit', async ({ page }) => {
    const user = await createTestUser({ role: 'user' })
    await loginAsUser(page, user)
    await page.goto('/pacientes')
    await page.getByRole('button', { name: /novo paciente|adicionar/i }).click()
    await page.getByLabel(/nome/i).fill('Teste')
    await page.getByLabel(/cpf/i).fill('123')
    await page.getByRole('button', { name: /salvar|criar/i }).click()
    await expect(page.getByText(/cpf.*invalido|deve ter/i)).toBeVisible()
  })
})
```

- [ ] **Step 3: Rodar, ajustar, commit**

```bash
pnpm test:e2e e2e/specs/app/patients.spec.ts
git add e2e/specs/app/patients.spec.ts src
git commit -m "test(e2e): adiciona spec de pacientes (lista, criacao, validacao)"
```

---

## Task 17: Spec `consultation.spec.ts`

**Files:**
- Create: `e2e/specs/app/consultation.spec.ts`

- [ ] **Step 1: Inspecionar fluxo de consulta**

Ler:
- `src/app/(app)/consulta/**`
- `src/context/ConsultationContext.tsx`
- Componentes de step (gravacao, transcricao, anamnese, refinamento)

- [ ] **Step 2: Escrever spec com mocks de IA**

```typescript
import { test, expect } from '@playwright/test'
import { createTestUser, loginAsUser } from '../../fixtures/auth'
import { createPatient } from '../../fixtures/seed'
import { mockAiEndpoints } from '../../fixtures/mocks'

test.describe('fluxo de consulta', () => {
  test('inicia consulta, mocka IA e gera relatorio', async ({ page }) => {
    await mockAiEndpoints(page)

    const user = await createTestUser({ role: 'user' })
    const patient = await createPatient(user.id)
    await loginAsUser(page, user)

    await page.goto('/pacientes')
    await page.getByText(patient.name).click()
    await page.getByRole('button', { name: /iniciar consulta|nova consulta/i }).click()

    // Step 1 — consentimento (texto exato pode variar)
    await page.getByRole('button', { name: /aceito|concordo|continuar/i }).click()

    // Steps de gravacao/transcricao — mocked, so clica avancar
    // Ajustar conforme UI real
    const proximoBtn = page.getByRole('button', { name: /proximo|avancar|gerar/i })
    while (await proximoBtn.isVisible().catch(() => false)) {
      await proximoBtn.click()
      await page.waitForTimeout(200) // pequena pausa pq UI tem state transitions
    }

    // Resultado final
    await expect(page.getByText(/queixa principal|anamnese|relatorio/i)).toBeVisible({
      timeout: 15_000,
    })
  })
})
```

**Nota:** O `waitForTimeout(200)` acima viola a regra do agente reviewer (`waitForTimeout` proibido). Durante implementacao, substituir por espera por elemento especifico de cada step (ex: `await expect(page.getByText(/transcricao concluida/i)).toBeVisible()`).

- [ ] **Step 3: Rodar, ajustar (eliminando `waitForTimeout`), commit**

```bash
pnpm test:e2e e2e/specs/app/consultation.spec.ts
git add e2e/specs/app/consultation.spec.ts src
git commit -m "test(e2e): adiciona spec do fluxo de consulta com IA mockada"
```

---

## Task 18: Spec `settings.spec.ts`

**Files:**
- Create: `e2e/specs/app/settings.spec.ts`

- [ ] **Step 1: Inspecionar `/configuracoes` (ou `/perfil`, `/clinica`, etc.)**

Anotar abas, campos, validacoes.

- [ ] **Step 2: Escrever spec**

```typescript
import { test, expect } from '@playwright/test'
import { createTestUser, loginAsUser } from '../../fixtures/auth'

test.describe('configuracoes do usuario', () => {
  test('edita nome profissional', async ({ page }) => {
    const user = await createTestUser({ role: 'user' })
    await loginAsUser(page, user)
    await page.goto('/configuracoes')

    const novoNome = `E2E Nome ${Date.now()}`
    await page.getByLabel(/nome/i).first().fill(novoNome)
    await page.getByRole('button', { name: /salvar/i }).first().click()
    await expect(page.getByText(/salvo|atualizado/i)).toBeVisible({ timeout: 5_000 })
  })

  test('edita dados da clinica', async ({ page }) => {
    const user = await createTestUser({ role: 'user' })
    await loginAsUser(page, user)
    await page.goto('/configuracoes')

    const tabClinica = page.getByRole('tab', { name: /clinica/i }).or(page.getByText(/dados da clinica/i))
    if (await tabClinica.isVisible().catch(() => false)) {
      await tabClinica.click()
    }
    await page.getByLabel(/nome.*clinica/i).fill('E2E Clinica')
    await page.getByRole('button', { name: /salvar/i }).first().click()
    await expect(page.getByText(/salvo|atualizado/i)).toBeVisible({ timeout: 5_000 })
  })
})
```

- [ ] **Step 3: Rodar, ajustar, commit**

```bash
pnpm test:e2e e2e/specs/app/settings.spec.ts
git add e2e/specs/app/settings.spec.ts src
git commit -m "test(e2e): adiciona spec de configuracoes do usuario"
```

---

# Fase 4 — Specs do console master

## Task 19: Spec `users.spec.ts` (console)

**Files:**
- Create: `e2e/specs/console/users.spec.ts`

- [ ] **Step 1: Inspecionar `/console/usuarios`**

- [ ] **Step 2: Escrever spec**

```typescript
import { test, expect } from '@playwright/test'
import { loginAsMaster, makeE2eId } from '../../fixtures/auth'

test.describe('console — usuarios', () => {
  test('master ve lista de usuarios', async ({ page }) => {
    await loginAsMaster(page)
    await page.goto('/console/usuarios')
    await expect(page.getByRole('heading', { name: /usuarios/i })).toBeVisible()
  })

  test('master cria novo usuario via AppDialog', async ({ page }) => {
    await loginAsMaster(page)
    await page.goto('/console/usuarios')
    await page.getByRole('button', { name: /novo usuario|adicionar/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    const uniqueId = makeE2eId()
    const email = `${uniqueId}@test.com`
    await page.getByLabel(/nome/i).fill(`E2E ${uniqueId}`)
    await page.getByLabel(/email/i).fill(email)
    // outros campos obrigatorios — ajustar apos inspecao
    await page.getByRole('button', { name: /criar|salvar/i }).click()

    await expect(page.getByText(email)).toBeVisible({ timeout: 10_000 })
  })
})
```

- [ ] **Step 3: Rodar, ajustar, commit**

```bash
pnpm test:e2e e2e/specs/console/users.spec.ts
git add e2e/specs/console/users.spec.ts src
git commit -m "test(e2e): adiciona spec do console de usuarios"
```

---

## Task 20: Spec `access-requests.spec.ts`

**Files:**
- Create: `e2e/specs/console/access-requests.spec.ts`

- [ ] **Step 1: Inspecionar `/console/solicitacoes`**

- [ ] **Step 2: Escrever spec**

```typescript
import { test, expect } from '@playwright/test'
import { loginAsMaster } from '../../fixtures/auth'
import { createAccessRequest } from '../../fixtures/seed'

test.describe('console — solicitacoes de acesso', () => {
  test('master ve solicitacao pendente', async ({ page }) => {
    const req = await createAccessRequest()
    await loginAsMaster(page)
    await page.goto('/console/solicitacoes')
    await expect(page.getByText(req.email)).toBeVisible()
  })

  test('master aprova solicitacao e cria usuario', async ({ page }) => {
    const req = await createAccessRequest()
    await loginAsMaster(page)
    await page.goto('/console/solicitacoes')

    const row = page.getByRole('row').filter({ hasText: req.email })
    await row.getByRole('button', { name: /aprovar|aceitar/i }).click()

    // confirmacao (se houver modal)
    const confirmBtn = page.getByRole('button', { name: /confirmar/i })
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click()
    }

    await expect(page.getByText(/aprovado|sucesso/i)).toBeVisible({ timeout: 10_000 })
  })
})
```

- [ ] **Step 3: Rodar, ajustar, commit**

```bash
pnpm test:e2e e2e/specs/console/access-requests.spec.ts
git add e2e/specs/console/access-requests.spec.ts src
git commit -m "test(e2e): adiciona spec de solicitacoes de acesso no console"
```

---

## Task 21: Spec `feedbacks.spec.ts`

**Files:**
- Create: `e2e/specs/console/feedbacks.spec.ts`

- [ ] **Step 1: Inspecionar `/console/feedbacks`**

- [ ] **Step 2: Escrever spec**

```typescript
import { test, expect } from '@playwright/test'
import { loginAsMaster, createTestUser } from '../../fixtures/auth'
import { getTestSupabase } from '../../fixtures/supabase'

test.describe('console — feedbacks', () => {
  test('master ve lista de feedbacks', async ({ page }) => {
    // seed direto
    const user = await createTestUser({ role: 'user' })
    const supabase = getTestSupabase()
    await supabase.from('feedbacks').insert({
      user_id: user.id,
      rating: 5,
      message: `E2E feedback ${Date.now()}`,
      plan_id: 'experimental',
    })

    await loginAsMaster(page)
    await page.goto('/console/feedbacks')
    await expect(page.getByRole('heading', { name: /feedbacks/i })).toBeVisible()
    await expect(page.getByText(/E2E feedback/).first()).toBeVisible()
  })
})
```

- [ ] **Step 3: Rodar, ajustar, commit**

```bash
pnpm test:e2e e2e/specs/console/feedbacks.spec.ts
git add e2e/specs/console/feedbacks.spec.ts src
git commit -m "test(e2e): adiciona spec de feedbacks no console"
```

---

# Fase 5 — Finalizacao

## Task 22: Atualizar `CLAUDE.md` com referencia ao novo agente

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Localizar a secao "Agentes especializados" e adicionar linha**

Adicionar apos a linha do `@stripe-reviewer`:

```markdown
- `@e2e-playwright-reviewer` — locators, viewports, mocks de IA e flakiness em specs Playwright
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): adiciona referencia ao agente e2e-playwright-reviewer"
```

---

## Task 23: Atualizar `docs/architecture.md` com diagrama E2E

**Files:**
- Modify: `docs/architecture.md`

- [ ] **Step 1: Adicionar diagrama Mermaid**

Adicionar nova secao "Camada E2E" ao `docs/architecture.md`:

````markdown
## Camada E2E (Playwright)

```mermaid
graph TD
    PW[Playwright runner] -->|sobe| DEV[pnpm dev :3000]
    PW -->|global-setup| GUARD[Valida ref do banco teste]
    GUARD -->|ok| FIXTURES[Fixtures: auth, seed, mocks]
    FIXTURES -->|service_role| SB[(Supabase teste)]
    PW -->|executa| SPECS[Specs em 4 viewports]
    SPECS --> APP[App Next.js]
    APP -->|API| SB
    SPECS -.->|mock| AI[/api/transcription, /api/anamnesis, /api/refine]
    PW -->|global-teardown| CLEANUP[cleanupE2eData LIKE 'e2e-%']
    CLEANUP --> SB
```

**Pontos-chave:**
- Guard rail bloqueia execucao contra producao
- Cada spec roda em 4 viewports (mobile/tablet/laptop/desktop)
- IA real nunca e chamada — mocks via `page.route()`
- Cleanup automatico ao final preserva master e dados sem prefixo `e2e-`
````

- [ ] **Step 2: Commit**

```bash
git add docs/architecture.md
git commit -m "docs(architecture): adiciona diagrama da camada E2E"
```

---

## Task 24: Smoke final + report

- [ ] **Step 1: Rodar suite completa**

```bash
pnpm test:e2e
```

Expected: todos os specs passam nos 4 viewports. Tempo total < 25min.

- [ ] **Step 2: Abrir relatorio HTML**

```bash
pnpm test:e2e:report
```

Verifica que todos os testes estao verdes no relatorio.

- [ ] **Step 3: Verificar banco limpo**

No SQL Editor do `anamnese-ia-com-claude-code--teste`:

```sql
SELECT COUNT(*) FROM users WHERE email LIKE 'e2e-%@test.com';
-- esperado: 0
SELECT COUNT(*) FROM access_requests WHERE email LIKE 'e2e-%@test.com';
-- esperado: 0
SELECT id, name, email, role FROM users;
-- esperado: apenas o master (projectanamneseai2026@gmail.com)
```

- [ ] **Step 4: Smoke na branch main**

```bash
git checkout main
git merge development
pnpm test:e2e
git push origin main
```

Expected: todos verdes na main, push aceito, Hostinger deploya.

- [ ] **Step 5: Voltar para development**

```bash
git checkout development
```

---

## Checklist final de aceite

- [ ] `pnpm test:e2e` retorna verde nos 4 viewports
- [ ] Banco limpo apos suite (apenas master)
- [ ] HTML report acessivel
- [ ] `e2e/README.md` cobre comandos, padroes e troubleshooting
- [ ] `docs/architecture.md` atualizado
- [ ] `CLAUDE.md` referencia o novo agente
- [ ] Agente `e2e-playwright-reviewer` criado e funcional
- [ ] Smoke run na branch `main` passou
- [ ] Nenhum `waitForTimeout` nas specs
- [ ] Nenhum locator CSS fragil
