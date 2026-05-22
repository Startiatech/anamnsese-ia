# Suite E2E com Playwright — Design

**Data:** 2026-05-22
**Status:** aprovado, aguardando plano de implementação
**Objetivo:** Completar a tríade de testes (unit + integration + E2E) cobrindo todas as telas do Anamnese IA com Playwright, validando funcionamento e responsividade em 4 viewports.

---

## 1. Contexto

O projeto já possui testes unitários (Vitest) e de integração (Vitest + Supabase real). Falta a camada E2E que valide o sistema **de ponta a ponta**, simulando interações reais de usuário no navegador. Antes desta entrega, foi feita a separação de ambientes (banco de produção `anamnese-ia` × banco de teste `anamnese-ia-com-claude-code--teste`) — pré-requisito para E2E rodar com segurança.

### Stack
- **Playwright `@playwright/test`** (TypeScript, assertions, traces, screenshots, parallelism nativos)
- Sem libs externas adicionais
- Banco: `anamnese-ia-com-claude-code--teste` (Supabase remoto, isolado)

---

## 2. Arquitetura

### Estrutura de pastas

```
e2e/
├── playwright.config.ts          # config raiz (4 viewports, webServer, baseURL)
├── fixtures/
│   ├── auth.ts                   # loginAsMaster, loginAsUser, createTestUser
│   ├── seed.ts                   # createPatient, createConsultation, cleanupE2eData
│   └── test-base.ts              # extends Playwright test() com fixtures customizadas
├── specs/
│   ├── public/
│   │   ├── landing.spec.ts
│   │   ├── login.spec.ts
│   │   └── request-access.spec.ts
│   ├── app/
│   │   ├── dashboard.spec.ts
│   │   ├── patients.spec.ts
│   │   ├── consultation.spec.ts
│   │   └── settings.spec.ts
│   └── console/
│       ├── users.spec.ts
│       ├── access-requests.spec.ts
│       └── feedbacks.spec.ts
├── global-setup.ts               # validacao de seguranca pre-suite
├── global-teardown.ts            # cleanupE2eData() ao final da suite
└── README.md                     # como rodar, padroes, troubleshooting
```

### Configuracao de viewports

Quatro `projects` no `playwright.config.ts`:

| Project | Largura × Altura | Equivale a |
|---|---|---|
| `mobile` | 375 × 667 | iPhone SE |
| `tablet` | 768 × 1024 | iPad |
| `laptop` | 1280 × 800 | notebook comum |
| `desktop` | 1920 × 1080 | full HD |

Cada spec roda automaticamente nos 4 projects (sem duplicacao de codigo). Assertions sensiveis a layout devem checar o viewport corrente quando UI diverge entre tamanhos.

### Servidor durante os testes

`webServer` no `playwright.config.ts` inicia `pnpm dev` em `localhost:3000` automaticamente antes da suite e finaliza ao termino. `baseURL` aponta para `http://localhost:3000` — todos os `page.goto('/...')` ficam relativos.

### Variaveis de ambiente

Playwright le **exclusivamente** do `.env.test` (ja existente). Em hipotese alguma le `.env.local` ou `.env.production`.

---

## 3. Estrategia de dados

### Padrao de identificacao

Todo dado criado por teste recebe prefixo `e2e-` + timestamp + sufixo aleatorio:

```typescript
const uniqueId = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const email = `${uniqueId}@test.com`
const patientName = `E2E_Patient_${uniqueId}`
```

Garante isolamento entre testes paralelos sem conflitos de unique constraint.

### Usuario master fixo (ancora)

`projectanamneseai2026@gmail.com` ja existe no banco de teste, role=`master`, e e **nunca** apagado pelo teardown. Os testes do console usam essa conta para logar.

### Cleanup

- **Por arquivo:** nenhum cleanup automatico (acumula durante a suite)
- **Apos suite inteira** (`globalTeardown`): roda `cleanupE2eData()` uma unica vez

`cleanupE2eData()` executa:
```sql
DELETE FROM api_usage_log WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'e2e-%@test.com');
DELETE FROM consultations WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'e2e-%@test.com');
DELETE FROM patients WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'e2e-%@test.com');
DELETE FROM feedbacks WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'e2e-%@test.com');
DELETE FROM access_requests WHERE email LIKE 'e2e-%@test.com';
DELETE FROM plan_interest WHERE email LIKE 'e2e-%@test.com';
DELETE FROM users WHERE email LIKE 'e2e-%@test.com';
```

Tolerante: nunca toca em registros sem prefixo `e2e-`.

### Salvaguarda anti-producao

`global-setup.ts` valida na inicializacao:

```typescript
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
if (!url || !url.includes('nnmpucgxehzvcliglayr')) {
  throw new Error('E2E so pode rodar contra anamnese-ia-com-claude-code--teste')
}
```

Compara contra o **ref do projeto de teste** (whitelist), nao contra prod (blacklist). Mais seguro: se um dia trocar de banco de teste, falha de cara em vez de bater em prod.

---

## 4. Cobertura de specs

### Publicas (3 specs)

| Spec | Assertions principais |
|---|---|
| `landing.spec.ts` | Hero visivel, CTAs clicaveis, links de nav levam aos destinos, footer presente |
| `login.spec.ts` | Login sucesso (master), falha (senha errada), validacao Zod (email invalido, senha curta), redirect pos-login para `/dashboard` |
| `request-access.spec.ts` | Formulario valida, submit cria `access_requests` com prefixo `e2e-`, mensagem de sucesso aparece |

### App — usuario profissional (4 specs)

| Spec | Assertions principais |
|---|---|
| `dashboard.spec.ts` | Creditos exibidos, nome do usuario, navegacao sidebar/topbar funciona em todos viewports |
| `patients.spec.ts` | Listar pacientes, criar via `AppSheet`, editar, validacoes Zod (CPF), buscar |
| `consultation.spec.ts` | Iniciar consulta, percorrer steps, gerar relatorio (com IA mockada), finalizar/abandonar |
| `settings.spec.ts` | Editar dados profissionais, editar dados clinica, trocar senha, trocar PIN |

### Console — master (3 specs)

| Spec | Assertions principais |
|---|---|
| `users.spec.ts` | Listar usuarios, criar via `AppDialog`, bloquear/desbloquear, ver detalhes |
| `access-requests.spec.ts` | Listar pendentes, aprovar (cria user), rejeitar |
| `feedbacks.spec.ts` | Listar, filtrar por rating, ver detalhes |

### Mocks de IA (critico para `consultation.spec.ts`)

Endpoints `/api/transcription`, `/api/anamnesis`, `/api/refine` sao **mockados via `page.route()`** retornando respostas fixas. Razoes:

- Chamadas reais a Groq/OpenAI sao **lentas** (5-20s por step)
- Custam dinheiro em cada run
- Sao **flaky** (rede, rate limit, indisponibilidade)
- E2E testa o fluxo do app, nao o servico externo

Helper centralizado em `e2e/fixtures/mocks.ts` aplica os mocks em qualquer teste que precise.

### Cobertura nos 4 viewports

Cada spec roda nos 4 projects. Quando UI muda dramaticamente entre tamanhos (ex: sidebar vira drawer no mobile, AppSheet ocupa tela inteira no mobile), o spec contem assertions condicionais baseadas em `test.info().project.name`.

### Estimativa de tempo

~25-40s por spec × 10 specs × 4 viewports ≈ **15-25 min de suite completa** (sequencial). Com `workers: 4` cai para ~5-8 min.

---

## 5. Agente especialista

### Novo agente: `e2e-playwright-reviewer`

Arquivo `.claude/agents/e2e-playwright-reviewer.md`. Especialista em revisar specs E2E antes do merge. Verifica:

- **Locators robustos:** prefere `getByRole`, `getByLabel`, `getByTestId`. Reprova seletores CSS frageis
- **Esperas corretas:** `await expect(...).toBeVisible()`, nunca `page.waitForTimeout()`
- **Isolamento:** confirma que cada teste cria proprios dados com prefixo `e2e-`
- **Sem efeito colateral em prod:** verifica guard rail e ausencia de URLs hardcoded de prod
- **Asserções significativas:** cada teste tem `expect()` claro, nao so "carregou"
- **Viewport-aware:** quando UI muda por tamanho, spec testa ambos
- **Mocks de IA:** specs de consulta mockam endpoints
- **Parallelism-safe:** sem race conditions

### Quadro final de agentes do projeto

```
@tdd-guide                 → unit + integration (sequencia TDD)
@e2e-playwright-reviewer   → E2E (Playwright, locators, viewports, flakiness)
@security-reviewer         → endpoints, schemas, auth
@ui-reviewer               → conformidade visual
@async-actions-reviewer    → loading/toast/redirect em forms
@stripe-reviewer           → pagamentos (futuro)
```

---

## 6. Padroes obrigatorios

Documentados em `e2e/README.md`. Resumo:

1. **Locators preferenciais:**
   ```typescript
   await page.getByRole('button', { name: /entrar/i }).click()
   await page.getByLabel('Email').fill(email)
   ```

2. **`data-testid` quando role/label nao basta:**
   ```typescript
   await page.getByTestId('patient-row-actions').click()
   ```
   Adicionado no codigo fonte apenas onde necessario.

3. **Asserções assincronas:**
   ```typescript
   await expect(page.getByText('Sucesso')).toBeVisible()
   ```
   Nunca `expect(await page.textContent(...))`.

4. **Nomeacao de testes em pt-br:**
   ```typescript
   test('paciente: criar com sucesso preenchendo todos os campos', ...)
   ```

5. **Estrutura de cada spec:**
   ```typescript
   test.describe('feature: paciente', () => {
     test('lista vazia exibe estado vazio', ...)
     test('criar com dados validos', ...)
   })
   ```

---

## 7. Scripts NPM

Adicionar ao `package.json`:

```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui",
"test:e2e:headed": "playwright test --headed",
"test:e2e:report": "playwright show-report"
```

**Nota:** o script `test:all` existente nao inclui E2E (E2E e lento e roda separado).

---

## 8. Observabilidade

Playwright ja fornece **sem configuracao adicional**:

- **Trace viewer** em falhas (snapshot da pagina, network log, console, timeline)
- **Screenshots** automaticos em falhas
- **Video** opcional em falhas (config `video: 'retain-on-failure'`)
- **HTML report** acessivel via `pnpm test:e2e:report`

CI/CD esta **fora do escopo deste MVP**. Workflow manual:
1. Roda E2E local em `development`
2. Merge para `main`
3. Roda E2E local em `main` (smoke test)
4. `git push` → Hostinger deploya producao

---

## 9. Fora de escopo

- **CI/CD** (GitHub Actions) — adicionado no futuro
- **Testes de acessibilidade profunda** (axe-core) — outra suite
- **Testes de performance** (Lighthouse CI) — outra suite
- **Stripe E2E** — projeto nao tem Stripe ainda
- **Cross-browser** alem de Chromium — Firefox/WebKit ficam para depois
- **Testes em mobile real** (BrowserStack) — emulacao de viewport e suficiente para MVP

---

## 10. Riscos e mitigacoes

| Risco | Mitigacao |
|---|---|
| Suite contra producao por engano | `global-setup.ts` valida ref do banco (whitelist) |
| Flakiness por timing | Sem `waitForTimeout`; uso de `expect().toBeVisible()` (com auto-retry) |
| Acumulo de lixo no banco de teste | `cleanupE2eData()` no `globalTeardown` |
| Custo/lentidao de IA real | Mock obrigatorio via `page.route()` em consultation |
| Conflito de unique constraint paralelo | Prefixo `e2e-${timestamp}-${rand}` garante unicidade |
| Master apagado por engano | `cleanupE2eData()` so deleta `LIKE 'e2e-%'` |

---

## 11. Criterios de aceite

- [ ] `pnpm test:e2e` roda toda suite e retorna verde nos 4 viewports
- [ ] Nenhum teste depende de outro (ordem de execucao irrelevante)
- [ ] `cleanupE2eData()` deixa banco sem registros com prefixo `e2e-`
- [ ] Master continua intacto apos rodar suite completa
- [ ] HTML report acessivel apos run
- [ ] Documentacao em `e2e/README.md` cobre: como rodar, padroes, troubleshooting
- [ ] `docs/architecture.md` atualizado com diagrama da camada E2E
- [ ] Agente `e2e-playwright-reviewer` criado e referenciado em `CLAUDE.md`

---

## 12. Proximo passo

Invocar o skill `superpowers:writing-plans` para detalhar o plano de implementacao passo-a-passo, com tasks em ordem de execucao, dependencias e checkpoints de review.
