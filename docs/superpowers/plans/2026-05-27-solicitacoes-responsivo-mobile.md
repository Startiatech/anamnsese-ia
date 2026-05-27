# Solicitações Responsivo Mobile (cards) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar a tela de Solicitações de acesso usável no celular (375px) para aprovar/rejeitar pedidos, via reflow de tabela → cards no mobile.

**Architecture:** A tabela atual recebe `hidden md:block` (só desktop); uma nova lista `md:hidden` renderiza um `RequestCard` por pedido com ações diretas (sem dropdown), mensagem inline (sem tooltip) e alvos de toque adequados. A lógica de negócio (handlers, fetch, WhatsApp, toasts, `processingId`, `CredentialsDialog`) permanece uma vez só em `requests-client.tsx` e é compartilhada pelas duas apresentações. O botão de copiar senha do `credentials-dialog` ganha alvo de toque ≥44px.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind (breakpoint `md`=768px), shadcn/ui, Vitest 4 + RTL, Playwright (projeto `mobile` 375px).

**Spec:** `docs/superpowers/specs/2026-05-27-solicitacoes-responsivo-mobile-design.md`

---

## File Structure

| Arquivo | Responsabilidade |
| --- | --- |
| `src/app/(admin)/console/requests/request-card.tsx` | **Novo.** Card apresentacional de um pedido (mobile). |
| `src/app/(admin)/console/requests/request-card.test.tsx` | **Novo.** Testes unitários do card. |
| `src/app/(admin)/console/requests/requests-client.tsx` | **Modificar.** Responsivo: tabela `hidden md:block` + lista de cards `md:hidden`. |
| `src/app/(admin)/console/requests/requests-client.test.tsx` | **Novo.** Integração: card renderiza e aprova/rejeita compartilhando a lógica. |
| `src/app/(admin)/console/requests/credentials-dialog.tsx` | **Modificar.** Botão copiar com alvo ≥44px. |
| `src/app/(admin)/console/requests/credentials-dialog.test.tsx` | **Novo.** Cópia ainda funciona. |
| `e2e/specs/console/solicitacoes.spec.ts` | **Modificar.** Teste no projeto `mobile` (375px). |
| `build-docs/2026-05-27/2026-05-27-solicitacoes-responsivo-mobile.md` | **Novo.** Build-doc. |

Convenções: testes co-localizados `.test.tsx`; Vitest 4 + RTL (jsdom); `pnpm test <arquivo>` (rodar arquivo único é permitido). **Não rodar `pnpm run build`.** Commits em português, Conventional Commits. Branch `development` (commit direto, autorizado). Tipo `AccessRequest` em `src/lib/types` tem: `id`, `name`, `email`, `specialty`, `phone`, `message?`, `status` ('pending'|'approved'|'rejected'), `createdAt`, `userPasswordIsTemp?`.

---

## Task 1: Componente `RequestCard` (apresentacional)

**Files:**
- Create: `src/app/(admin)/console/requests/request-card.tsx`
- Test: `src/app/(admin)/console/requests/request-card.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RequestCard } from './request-card'
import type { AccessRequest } from '@/lib/types'

function makeRequest(overrides: Partial<AccessRequest> = {}): AccessRequest {
  return {
    id: 'r1',
    name: 'Profissional Um Teste',
    email: 'profissionalumteste@gmail.com',
    specialty: 'Neurologia',
    phone: '(32) 99999-9999',
    message: 'Gostaria de testar a plataforma.',
    status: 'pending',
    createdAt: '2026-05-27T14:30:00.000Z',
    userPasswordIsTemp: false,
    ...overrides,
  } as AccessRequest
}

function noopHandlers() {
  return { onApprove: vi.fn(), onReject: vi.fn(), onViewCredentials: vi.fn() }
}

describe('RequestCard', () => {
  it('shows name, full email and inline message', () => {
    const h = noopHandlers()
    render(<RequestCard request={makeRequest()} processing={false} {...h} />)
    expect(screen.getByText('Profissional Um Teste')).toBeInTheDocument()
    expect(screen.getByText('profissionalumteste@gmail.com')).toBeInTheDocument()
    expect(screen.getByText(/Gostaria de testar a plataforma/)).toBeInTheDocument()
  })

  it('does not render the message block when there is no message', () => {
    const h = noopHandlers()
    render(<RequestCard request={makeRequest({ message: undefined })} processing={false} {...h} />)
    expect(screen.queryByText(/Mensagem/i)).not.toBeInTheDocument()
  })

  it('renders Aprovar/Rejeitar for pending and calls handlers', async () => {
    const user = userEvent.setup()
    const h = noopHandlers()
    const req = makeRequest({ status: 'pending' })
    render(<RequestCard request={req} processing={false} {...h} />)

    await user.click(screen.getByRole('button', { name: /aprovar/i }))
    expect(h.onApprove).toHaveBeenCalledWith(req)

    await user.click(screen.getByRole('button', { name: /rejeitar/i }))
    expect(h.onReject).toHaveBeenCalledWith(req)
  })

  it('renders Ver credenciais for approved + temp password', async () => {
    const user = userEvent.setup()
    const h = noopHandlers()
    const req = makeRequest({ status: 'approved', userPasswordIsTemp: true })
    render(<RequestCard request={req} processing={false} {...h} />)
    const btn = screen.getByRole('button', { name: /ver credenciais/i })
    await user.click(btn)
    expect(h.onViewCredentials).toHaveBeenCalledWith(req)
  })

  it('renders no action buttons for rejected', () => {
    const h = noopHandlers()
    render(<RequestCard request={makeRequest({ status: 'rejected' })} processing={false} {...h} />)
    expect(screen.queryByRole('button', { name: /aprovar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /rejeitar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ver credenciais/i })).not.toBeInTheDocument()
  })

  it('disables actions and shows Aguarde when processing', () => {
    const h = noopHandlers()
    render(<RequestCard request={makeRequest({ status: 'pending' })} processing={true} {...h} />)
    expect(screen.getByRole('button', { name: /aguarde/i })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/app/(admin)/console/requests/request-card.test.tsx`
Expected: FAIL — módulo `./request-card` não encontrado.

- [ ] **Step 3: Write minimal implementation**

```tsx
'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/console/status-badge'
import type { AccessRequest } from '@/lib/types'

interface RequestCardProps {
  request: AccessRequest
  processing: boolean
  onApprove: (request: AccessRequest) => void
  onReject: (request: AccessRequest) => void
  onViewCredentials: (request: AccessRequest) => void
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground text-right">{value}</span>
    </div>
  )
}

export function RequestCard({
  request, processing, onApprove, onReject, onViewCredentials,
}: RequestCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{request.name}</p>
        <p className="text-xs text-muted-foreground break-all">{request.email}</p>
      </div>

      <div className="space-y-1.5">
        <Field label="Especialidade" value={request.specialty} />
        <Field label="Telefone" value={request.phone} />
        <Field label="Situação" value={<StatusBadge variant="request" status={request.status} />} />
        <Field label="Data" value={formatDate(request.createdAt)} />
      </div>

      {request.message && (
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Mensagem</span>
          <p className={`text-sm italic text-foreground ${expanded ? '' : 'line-clamp-3'}`}>
            &ldquo;{request.message}&rdquo;
          </p>
          {request.message.length > 120 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-primary hover:underline"
            >
              {expanded ? 'ver menos' : 'ver mais'}
            </button>
          )}
        </div>
      )}

      {request.status === 'pending' && (
        <div className="flex gap-2 pt-1">
          <Button
            onClick={() => onApprove(request)}
            disabled={processing}
            className="flex-1 h-10 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <CheckCircle className="h-4 w-4" />
            {processing ? 'Aguarde...' : 'Aprovar'}
          </Button>
          <Button
            onClick={() => onReject(request)}
            disabled={processing}
            variant="outline"
            className="flex-1 h-10 gap-1.5 text-red-600 dark:text-red-400"
          >
            <XCircle className="h-4 w-4" />
            {processing ? 'Aguarde...' : 'Rejeitar'}
          </Button>
        </div>
      )}

      {request.status === 'approved' && request.userPasswordIsTemp && (
        <Button
          onClick={() => onViewCredentials(request)}
          disabled={processing}
          variant="outline"
          className="w-full h-10 gap-1.5"
        >
          <KeyRound className="h-4 w-4" />
          {processing ? 'Aguarde...' : 'Ver credenciais'}
        </Button>
      )}
    </div>
  )
}
```

Note: `formatDate` is intentionally duplicated from `requests-client.tsx` (one small helper) to keep the card self-contained. If a future task extracts a shared formatter, both can consume it then.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/app/(admin)/console/requests/request-card.test.tsx`
Expected: PASS (6 passing).

- [ ] **Step 5: Commit**

```bash
git add src/app/(admin)/console/requests/request-card.tsx src/app/(admin)/console/requests/request-card.test.tsx
git commit -m "feat(console): card de solicitacao para layout mobile"
```

---

## Task 2: Tornar `requests-client` responsivo (tabela desktop + cards mobile)

**Files:**
- Modify: `src/app/(admin)/console/requests/requests-client.tsx`
- Test: `src/app/(admin)/console/requests/requests-client.test.tsx` (novo)

Antes de escrever o teste, LEIA `src/context/console-notification-context.tsx` para saber o nome exato do provider e suas props (o `RequestsClient` consome `useConsoleNotification()` que expõe `{ requests, setRequests }`). O teste deve envolver o componente nesse provider real, passando `initialRequests`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RequestsClient } from './requests-client'
import { ConsoleNotificationProvider } from '@/context/console-notification-context'
import type { AccessRequest } from '@/lib/types'

function pendingRequest(): AccessRequest {
  return {
    id: 'r1', name: 'Maria Teste', email: 'maria@x.com', specialty: 'Cardio',
    phone: '(32) 90000-0000', message: undefined, status: 'pending',
    createdAt: '2026-05-27T14:30:00.000Z', userPasswordIsTemp: false,
  } as AccessRequest
}

function renderWithProvider(requests: AccessRequest[]) {
  return render(
    <ConsoleNotificationProvider initialRequests={requests} initialA11yPendingCount={0}>
      <RequestsClient initialRequests={requests} />
    </ConsoleNotificationProvider>,
  )
}

describe('RequestsClient (responsivo)', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('renders the desktop table wrapper hidden on mobile', () => {
    const { container } = renderWithProvider([pendingRequest()])
    // wrapper da tabela tem as classes responsivas
    const tableWrapper = container.querySelector('.hidden.md\\:block')
    expect(tableWrapper).not.toBeNull()
  })

  it('renders a mobile card list hidden on desktop', () => {
    const { container } = renderWithProvider([pendingRequest()])
    const cardList = container.querySelector('.md\\:hidden')
    expect(cardList).not.toBeNull()
  })

  it('approving from the mobile card triggers the create-user request', async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )
    vi.spyOn(window, 'open').mockReturnValue(null)

    renderWithProvider([pendingRequest()])

    // o botao "Aprovar" direto so existe no card mobile (na tabela fica dentro do dropdown fechado)
    await user.click(screen.getByRole('button', { name: /aprovar/i }))

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/admin/create-user',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/app/(admin)/console/requests/requests-client.test.tsx`
Expected: FAIL — não há `.md:hidden` card list ainda; o botão "Aprovar" direto não existe (só o dropdown).

- [ ] **Step 3: Implement responsive split**

Em `src/app/(admin)/console/requests/requests-client.tsx`:

1. Importar o card no topo:
```tsx
import { RequestCard } from './request-card'
```

2. Localizar o bloco que renderiza a tabela (o `<div className="rounded-xl border border-border overflow-hidden">` que envolve `<Table>`). Adicionar `hidden md:block` a esse wrapper:
```tsx
          <div className="hidden md:block rounded-xl border border-border overflow-hidden">
            <Table>
              {/* ...inalterado... */}
            </Table>
          </div>
```

3. Imediatamente APÓS esse wrapper da tabela (ainda dentro do `TooltipProvider`/do mesmo ramo onde `sorted.length > 0`), adicionar a lista de cards mobile:
```tsx
          <div className="md:hidden space-y-3">
            {sorted.map((r) => (
              <RequestCard
                key={r.id}
                request={r}
                processing={processingId === r.id}
                onApprove={handleApprove}
                onReject={handleReject}
                onViewCredentials={handleViewCredentials}
              />
            ))}
          </div>
```

Não alterar handlers, filtros, `processingId`, nem o `CredentialsDialog` — são compartilhados. O `overflow-hidden` agora vive apenas no wrapper `hidden md:block` (desktop), então não corta nada no mobile.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/app/(admin)/console/requests/requests-client.test.tsx`
Expected: PASS (3 passing). Se o provider exigir props adicionais, ajustar o `renderWithProvider` conforme o arquivo de contexto lido — mantendo a intenção dos asserts.

- [ ] **Step 5: Commit**

```bash
git add src/app/(admin)/console/requests/requests-client.tsx src/app/(admin)/console/requests/requests-client.test.tsx
git commit -m "feat(console): solicitacoes responsivas (tabela desktop + cards mobile)"
```

---

## Task 3: Alvo de toque do botão copiar no `credentials-dialog`

**Files:**
- Modify: `src/app/(admin)/console/requests/credentials-dialog.tsx`
- Test: `src/app/(admin)/console/requests/credentials-dialog.test.tsx` (novo)

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CredentialsDialog } from './credentials-dialog'

describe('CredentialsDialog', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('copies the password when the copy button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <CredentialsDialog
        open
        onOpenChange={() => {}}
        name="Maria Teste"
        email="maria@x.com"
        phone="(32) 90000-0000"
        password="abc12345"
      />,
    )
    await user.click(screen.getByRole('button', { name: /copiar senha/i }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('abc12345')
  })

  it('exposes the copy action with an accessible label', () => {
    render(
      <CredentialsDialog
        open
        onOpenChange={() => {}}
        name="Maria Teste"
        email="maria@x.com"
        phone="(32) 90000-0000"
        password="abc12345"
      />,
    )
    expect(screen.getByRole('button', { name: /copiar senha/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails or passes**

Run: `pnpm test src/app/(admin)/console/requests/credentials-dialog.test.tsx`
Expected: PASS já no comportamento de cópia (o teste documenta o contrato antes do ajuste de toque). Se PASSAR, prossiga ao Step 3 para o ajuste de toque mantendo o teste verde (este teste é a rede de segurança de que o ajuste não quebra a cópia).

- [ ] **Step 3: Increase the tap target**

Em `credentials-dialog.tsx`, trocar o botão de copiar (`size="icon"`, 32px) por um alvo de toque ≥44px com rótulo visível:

```tsx
            <Button
              type="button"
              variant="outline"
              onClick={handleCopy}
              aria-label="Copiar senha"
              className="h-11 shrink-0 gap-1.5 px-3"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
```

(Remover o `size="icon"`. O `aria-label="Copiar senha"` permanece para o seletor de teste e a11y.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/app/(admin)/console/requests/credentials-dialog.test.tsx`
Expected: PASS (2 passing).

- [ ] **Step 5: Commit**

```bash
git add src/app/(admin)/console/requests/credentials-dialog.tsx src/app/(admin)/console/requests/credentials-dialog.test.tsx
git commit -m "fix(console): alvo de toque do botao copiar senha no fluxo mobile"
```

---

## Task 4: E2E mobile — aprovar/rejeitar visível e clicável

**Files:**
- Modify: `e2e/specs/console/solicitacoes.spec.ts`

Antes de escrever, LEIA `e2e/specs/console/solicitacoes.spec.ts` e `e2e/fixtures/` para entender como o spec autentica como master, faz seed de uma solicitação pendente e navega até `/console/requests`. REUSE esses helpers.

- [ ] **Step 1: Write the failing/representative E2E test**

Adicionar um teste que roda no projeto `mobile` (375px). Usar sinais observáveis (sem `waitForTimeout`):

```typescript
test('mobile: botoes Aprovar/Rejeitar visiveis e clicaveis num pedido pendente', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'cenario especifico do viewport mobile')

  // ... reuse helpers existentes: login como master + seed de 1 solicitacao pendente ...
  // navegar para a tela de solicitacoes (mesma rota usada pelos testes existentes)

  // No mobile, o card expoe os botoes diretos. Eles devem estar visiveis (nao escondidos
  // atras de scroll horizontal ou dropdown) e clicaveis.
  const aprovar = page.getByRole('button', { name: /aprovar/i })
  await expect(aprovar).toBeVisible()
  await expect(page.getByRole('button', { name: /rejeitar/i })).toBeVisible()

  // Sanidade: a pagina nao tem scroll horizontal (conteudo cabe em 375px).
  const hasHScroll = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(hasHScroll).toBe(false)
})
```

> Nota ao implementador: alinhe o setup (login master + seed) ao padrão já presente em `solicitacoes.spec.ts`. Se o spec existente não tiver helper de seed de solicitação pendente, reutilize o que ele já usa para popular a lista. Se o ambiente E2E não puder rodar aqui (sem dev server/DB/browsers), deixe o teste ESCRITO e relate que não foi executado — não simule verde.

- [ ] **Step 2: Run the mobile E2E**

Run: `pnpm test:e2e e2e/specs/console/solicitacoes.spec.ts --project=mobile`
Expected: PASS (ou, se o ambiente não permitir rodar aqui, reportar DONE_WITH_CONCERNS com instruções de execução).

- [ ] **Step 3: Commit**

```bash
git add e2e/specs/console/solicitacoes.spec.ts
git commit -m "test(e2e): valida acoes de solicitacao visiveis no mobile (375px)"
```

---

## Task 5: Build-doc

**Files:**
- Create: `build-docs/2026-05-27/2026-05-27-solicitacoes-responsivo-mobile.md`

- [ ] **Step 1: Criar o build-doc**

LEIA `build-docs/2026-05-26/2026-05-26-ajustes-ui.md` para o formato. Documentar: Contexto (master precisa aprovar pelo celular), Diagnóstico (baseline do @responsive-reviewer: overflow da tabela, dropdown na borda, tooltip hover-only, tap targets), Alterações numeradas com links de arquivo (RequestCard, requests-client responsivo, credentials-dialog tap target, E2E mobile), TDD/cobertura (contagens: request-card 6, requests-client 3, credentials-dialog 2, E2E mobile), e Pendências/Fora de escopo (Usuários/Planos e PageHeader para o esforço mobile futuro; criação do agente `@responsive-reviewer`).

- [ ] **Step 2: Commit**

```bash
git add build-docs/2026-05-27/2026-05-27-solicitacoes-responsivo-mobile.md
git commit -m "docs: build-doc da responsividade mobile das solicitacoes"
```

- [ ] **Step 3: Validação final (pelo usuário)**

Pedir ao usuário (não rodar build): rodar `pnpm run test:all` e, no ambiente apropriado, `pnpm test:e2e e2e/specs/console/solicitacoes.spec.ts --project=mobile`. Corrigir o que aparecer.

---

## Self-Review (autor do plano)

- **Cobertura do spec:** RequestCard com paridade total + ações por status (Task 1) · reflow responsivo `hidden md:block`/`md:hidden` com lógica compartilhada (Task 2) · mensagem inline sem tooltip (Task 1) · email completo (Task 1) · tap target do copiar senha (Task 3) · E2E mobile 375px (Task 4) · build-doc (Task 5). ✅ Sem lacunas. Fora de escopo (Usuários/Planos, PageHeader) explicitamente deferido.
- **Placeholders:** os pontos "leia o provider/fixtures e alinhe o setup" (Tasks 2 e 4) referem-se a reutilizar infra existente (contexto de notificação, helpers de seed E2E) — o comportamento a verificar está explícito; não são TODOs de design.
- **Consistência de tipos:** `RequestCardProps` (request/processing/onApprove/onReject/onViewCredentials) definido na Task 1 e consumido igual na Task 2. `AccessRequest` e seus campos usados consistentemente. `aria-label="Copiar senha"` mantido entre Task 3 impl e seus testes.
