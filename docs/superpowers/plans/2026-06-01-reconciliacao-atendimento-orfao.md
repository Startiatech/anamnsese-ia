# Reconciliação de Atendimento Órfão Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Garantir que um atendimento nunca fique preso em `in_progress`: quando o médico segue em frente ou o tempo estoura, o atendimento órfão é resolvido para um estado terminal (devolvendo o crédito se não houve uso de IA) — sempre pelo banco como fonte de verdade.

**Architecture:** Uma função pura `resolveTerminalState(row)` decide, a partir do banco, o estado terminal (`completed` se já havia anamnese anterior — preserva histórico; senão `abandoned`) e se há devolução de crédito (`debit_source != null && audio_attempts === 0`). Essa função é o único ponto de decisão, reusado por: (a) abandono manual, (b) gatilho de reconciliação ao iniciar outro atendimento, (c) varredura por TTL no load do dashboard. Tudo server-side, determinístico, sem cron nem websocket.

**Tech Stack:** Next.js 16 App Router · Server Actions · Supabase (service_role) · Vitest. Mock Supabase no padrão hoisted do projeto (ver `src/server/actions/consultation.test.ts`).

**Seam para Fase 2 (timeline de eventos):** o único choke point de resolução é `resolveTerminalState` + os pontos que aplicam o update. A emissão de `activity_events` (paciente cadastrado/deletado/atendimento completado/interrompido) da Fase 2 vai se plugar exatamente aí. **Não** criar código morto de evento agora (YAGNI).

---

## File Structure

- `src/lib/consultation-state.ts` — **Criar.** Função pura `resolveTerminalState`. Sem I/O, fácil de testar.
- `src/lib/consultation-state.test.ts` — **Criar.** Testes unitários puros.
- `src/server/actions/consultation.ts` — **Modificar.** `abandonConsultation` usa o helper; adicionar `reconcileOrphanConsultations` e `reconcileStaleConsultations`.
- `src/server/actions/consultation.test.ts` — **Modificar.** Testes das novas ações + abandono refatorado.
- `src/app/(app)/app/dashboard/page.tsx` — **Modificar.** Chamar `reconcileStaleConsultations()` antes de buscar consultas.

---

### Task 1: Helper puro de estado terminal

**Files:**
- Create: `src/lib/consultation-state.ts`
- Test: `src/lib/consultation-state.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```typescript
// src/lib/consultation-state.test.ts
import { describe, it, expect } from 'vitest'
import { resolveTerminalState } from './consultation-state'

describe('resolveTerminalState', () => {
  it('abandona e devolve quando sem IA, sem anamnese anterior e com debit_source', () => {
    expect(resolveTerminalState({ audio_attempts: 0, structured_anamnesis: { sections: [] }, debit_source: 'paid' }))
      .toEqual({ status: 'abandoned', refundSource: 'paid' })
  })

  it('abandona sem devolver quando houve IA (audio_attempts > 0) e sem anamnese anterior', () => {
    expect(resolveTerminalState({ audio_attempts: 2, structured_anamnesis: { sections: [] }, debit_source: 'paid' }))
      .toEqual({ status: 'abandoned', refundSource: null })
  })

  it('volta para completed (preserva histórico) quando já havia anamnese anterior', () => {
    expect(resolveTerminalState({ audio_attempts: 0, structured_anamnesis: { sections: [{ title: 'HDA', content: 'x' }] }, debit_source: 'bonus' }))
      .toEqual({ status: 'completed', refundSource: 'bonus' })
  })

  it('completed com IA usada não devolve crédito', () => {
    expect(resolveTerminalState({ audio_attempts: 1, structured_anamnesis: { sections: [{ title: 'HDA', content: 'x' }] }, debit_source: 'paid' }))
      .toEqual({ status: 'completed', refundSource: null })
  })

  it('sem debit_source nunca devolve', () => {
    expect(resolveTerminalState({ audio_attempts: 0, structured_anamnesis: null, debit_source: null }))
      .toEqual({ status: 'abandoned', refundSource: null })
  })

  it('trata structured_anamnesis null/sem sections como sem anamnese', () => {
    expect(resolveTerminalState({ audio_attempts: 0, structured_anamnesis: null, debit_source: 'paid' }).status).toBe('abandoned')
    expect(resolveTerminalState({ audio_attempts: 0, structured_anamnesis: {}, debit_source: 'paid' }).status).toBe('abandoned')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test -- src/lib/consultation-state.test.ts`
Expected: FAIL (`resolveTerminalState is not a function` / módulo não existe)

- [ ] **Step 3: Implementar o mínimo**

```typescript
// src/lib/consultation-state.ts

export interface TerminalStateInput {
  audio_attempts?: number | null
  structured_anamnesis?: unknown
  debit_source?: 'bonus' | 'paid' | null
}

export interface TerminalStateResult {
  status: 'completed' | 'abandoned'
  refundSource: 'bonus' | 'paid' | null
}

function hasAnamnesis(anamnesis: unknown): boolean {
  if (!anamnesis || typeof anamnesis !== 'object') return false
  const sections = (anamnesis as { sections?: unknown }).sections
  return Array.isArray(sections) && sections.length > 0
}

/**
 * Decide o estado terminal de um atendimento a partir do estado do banco.
 * - completed: já havia anamnese concluída (preserva o histórico clínico).
 * - abandoned: nunca houve anamnese.
 * Devolve crédito apenas se um crédito foi debitado (debit_source) e nenhuma
 * IA foi usada (audio_attempts === 0).
 */
export function resolveTerminalState(input: TerminalStateInput): TerminalStateResult {
  const aiUsed = (input.audio_attempts ?? 0) > 0
  const status: 'completed' | 'abandoned' = hasAnamnesis(input.structured_anamnesis) ? 'completed' : 'abandoned'
  const refundSource = !aiUsed && input.debit_source ? input.debit_source : null
  return { status, refundSource }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm test -- src/lib/consultation-state.test.ts`
Expected: PASS (6 testes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/consultation-state.ts src/lib/consultation-state.test.ts
git commit -m "feat(atendimento): helper puro resolveTerminalState (estado terminal + devolucao via banco)"
```

---

### Task 2: `abandonConsultation` usa o helper (preserva histórico)

**Files:**
- Modify: `src/server/actions/consultation.ts:44-82` (função `abandonConsultation`)
- Test: `src/server/actions/consultation.test.ts` (bloco `describe('abandonConsultation')`)

- [ ] **Step 1: Escrever/ajustar o teste que falha**

Adicionar dentro do `describe('abandonConsultation')` (o `mockSingle` do `beforeEach` já retorna `{ debit_source, audio_attempts }`; estender para incluir `structured_anamnesis`). Substituir o `beforeEach` do bloco por:

```typescript
  beforeEach(() => {
    vi.clearAllMocks()
    buildChain()
    mockGetServerUser.mockResolvedValue({ sub: 'user-1' })
    mockSingle.mockResolvedValue({ data: { debit_source: 'paid', audio_attempts: 0, structured_anamnesis: { sections: [] } }, error: null })
    mockUpsert.mockResolvedValue({})
    mockRefundCredit.mockResolvedValue(undefined)
  })
```

E adicionar os testes:

```typescript
  it('volta status para completed quando já havia anamnese anterior (preserva histórico)', async () => {
    mockSingle.mockResolvedValueOnce({ data: { debit_source: 'paid', audio_attempts: 0, structured_anamnesis: { sections: [{ title: 'HDA', content: 'x' }] } }, error: null })
    await abandonConsultation('patient-1', 3)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' }),
      expect.anything(),
    )
    // ainda devolve: sem IA
    expect(mockRefundCredit).toHaveBeenCalledWith('user-1', 'paid')
  })

  it('NÃO carimba created_at/updated_at ao voltar para completed (preserva a data real do atendimento)', async () => {
    mockSingle.mockResolvedValueOnce({ data: { debit_source: null, audio_attempts: 1, structured_anamnesis: { sections: [{ title: 'HDA', content: 'x' }] } }, error: null })
    await abandonConsultation('patient-1', 3)
    const payload = mockUpsert.mock.calls[0][0] as Record<string, unknown>
    expect(payload.status).toBe('completed')
    expect('created_at' in payload).toBe(false)
    expect('updated_at' in payload).toBe(false)
  })
```

> Observação: os testes existentes do bloco (`status: 'abandoned'`, `raw_transcript: null`, refund por carteira) continuam válidos porque `structured_anamnesis: { sections: [] }` → `abandoned`. Onde um teste antigo afirmar `updated_at` no caminho `abandoned`, manter; o `updated_at` só é omitido no caminho `completed`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test -- src/server/actions/consultation.test.ts`
Expected: FAIL nos 2 testes novos (status volta `abandoned`, não `completed`)

- [ ] **Step 3: Implementar**

Substituir o corpo de `abandonConsultation` em `src/server/actions/consultation.ts`:

```typescript
import { resolveTerminalState } from '@/lib/consultation-state'
// ...

export async function abandonConsultation(
  patientId: string,
  currentStep: ConsultationStep,
): Promise<void> {
  const user = await getServerUser()
  if (!user) return

  // Fonte de verdade = banco. Lê tudo o que decide o desfecho.
  const { data: existing } = await supabase
    .from('consultations')
    .select('debit_source, audio_attempts, structured_anamnesis')
    .eq('user_id', user.sub)
    .eq('patient_id', patientId)
    .single()

  const { status, refundSource } = resolveTerminalState({
    audio_attempts: existing?.audio_attempts as number | null | undefined,
    structured_anamnesis: existing?.structured_anamnesis,
    debit_source: (existing?.debit_source ?? null) as 'bonus' | 'paid' | null,
  })

  // raw_transcript sempre limpo (privacidade). created_at/updated_at NÃO são
  // tocados no caminho 'completed' para preservar a data real do atendimento
  // (carimbada em ConsultationRepository.save). No caminho 'abandoned' também
  // não bumpamos updated_at — abandonar não é um "atendimento" datável.
  await supabase.from('consultations').upsert(
    {
      user_id: user.sub,
      patient_id: patientId,
      status,
      current_step: currentStep,
      raw_transcript: null,
    },
    { onConflict: 'user_id,patient_id' },
  )

  if (refundSource) {
    await CreditRepository.refundCredit(user.sub, refundSource)
  }
}
```

> Se algum teste existente afirmava `updated_at` no payload de abandono, removê-lo nesse mesmo passo (o novo comportamento não grava `updated_at`).

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm test -- src/server/actions/consultation.test.ts`
Expected: PASS (bloco abandonConsultation todo verde)

- [ ] **Step 5: Commit**

```bash
git add src/server/actions/consultation.ts src/server/actions/consultation.test.ts
git commit -m "feat(atendimento): abandono usa resolveTerminalState e preserva anamnese anterior"
```

---

### Task 3: `reconcileOrphanConsultations` (gatilho ao iniciar outro atendimento)

**Files:**
- Modify: `src/server/actions/consultation.ts` (nova função exportada `reconcileOrphanConsultations`)
- Test: `src/server/actions/consultation.test.ts` (novo `describe`)

Resolve atendimentos `in_progress` do usuário **com `audio_attempts === 0`** (reservado mas sem trabalho), exceto o paciente informado. Conservador de propósito: não mexe em `in_progress` com IA usada (esse fica para o TTL), evitando descartar trabalho em andamento.

- [ ] **Step 1: Escrever o teste que falha**

```typescript
describe('reconcileOrphanConsultations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    buildChain()
    mockGetServerUser.mockResolvedValue({ sub: 'user-1' })
    mockRefundCredit.mockResolvedValue(undefined)
    mockUpsert.mockResolvedValue({})
  })

  it('não faz nada quando não autenticado', async () => {
    mockGetServerUser.mockResolvedValue(null)
    await reconcileOrphanConsultations('patient-keep')
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it('resolve e devolve cada órfão sem IA, exceto o paciente atual', async () => {
    // a query final (.eq/.neq/.eq) resolve numa lista
    chain.eq.mockReturnValueOnce(chain) // user_id
    chain.eq.mockReturnValueOnce(chain) // status in_progress
    chain.eq.mockReturnValueOnce(chain) // audio_attempts 0
    chain.neq = vi.fn().mockResolvedValue({
      data: [
        { patient_id: 'p-a', debit_source: 'paid', audio_attempts: 0, structured_anamnesis: { sections: [] } },
        { patient_id: 'p-b', debit_source: 'bonus', audio_attempts: 0, structured_anamnesis: { sections: [{ title: 'HDA', content: 'x' }] } },
      ],
      error: null,
    })

    await reconcileOrphanConsultations('patient-keep')

    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({ patient_id: 'p-a', status: 'abandoned' }), expect.anything())
    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({ patient_id: 'p-b', status: 'completed' }), expect.anything())
    expect(mockRefundCredit).toHaveBeenCalledWith('user-1', 'paid')
    expect(mockRefundCredit).toHaveBeenCalledWith('user-1', 'bonus')
  })

  it('não devolve nada quando não há órfãos', async () => {
    chain.neq = vi.fn().mockResolvedValue({ data: [], error: null })
    await reconcileOrphanConsultations('patient-keep')
    expect(mockRefundCredit).not.toHaveBeenCalled()
  })
})
```

> Importar `reconcileOrphanConsultations` no bloco de imports do topo do arquivo de teste.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test -- src/server/actions/consultation.test.ts`
Expected: FAIL (`reconcileOrphanConsultations is not exported`)

- [ ] **Step 3: Implementar**

```typescript
export async function reconcileOrphanConsultations(exceptPatientId: string): Promise<void> {
  const user = await getServerUser()
  if (!user) return

  // Órfãos = in_progress SEM uso de IA (audio_attempts = 0): crédito reservado
  // mas nenhum trabalho feito. Exclui o paciente que está sendo iniciado agora.
  const { data: orphans } = await supabase
    .from('consultations')
    .select('patient_id, debit_source, audio_attempts, structured_anamnesis')
    .eq('user_id', user.sub)
    .eq('status', 'in_progress')
    .eq('audio_attempts', 0)
    .neq('patient_id', exceptPatientId)

  for (const row of (orphans ?? [])) {
    const { status, refundSource } = resolveTerminalState({
      audio_attempts: row.audio_attempts as number | null,
      structured_anamnesis: row.structured_anamnesis,
      debit_source: (row.debit_source ?? null) as 'bonus' | 'paid' | null,
    })
    await supabase.from('consultations').upsert(
      {
        user_id: user.sub,
        patient_id: row.patient_id as string,
        status,
        raw_transcript: null,
      },
      { onConflict: 'user_id,patient_id' },
    )
    if (refundSource) {
      await CreditRepository.refundCredit(user.sub, refundSource)
    }
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm test -- src/server/actions/consultation.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/actions/consultation.ts src/server/actions/consultation.test.ts
git commit -m "feat(atendimento): reconcileOrphanConsultations devolve creditos de in_progress sem IA"
```

---

### Task 4: Disparar reconciliação ao debitar (gatilho 1)

**Files:**
- Modify: `src/server/actions/consultation.ts` (função `debitConsultationCredit`, após sucesso do débito)
- Test: `src/server/actions/consultation.test.ts` (bloco `debitConsultationCredit`)

- [ ] **Step 1: Escrever o teste que falha**

Adicionar no `describe('debitConsultationCredit')`:

```typescript
  it('reconcilia órfãos de outros pacientes ao iniciar (exceto o atual)', async () => {
    // após o upsert do débito, a query de órfãos resolve vazia
    chain.neq = vi.fn().mockResolvedValue({ data: [], error: null })
    await debitConsultationCredit('patient-1')
    // a varredura de in_progress foi disparada filtrando por status
    expect(chain.eq).toHaveBeenCalledWith('status', 'in_progress')
  })
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test -- src/server/actions/consultation.test.ts`
Expected: FAIL (`status, 'in_progress'` nunca chamado em debit)

- [ ] **Step 3: Implementar**

Em `debitConsultationCredit`, antes do `return {}` final (após o upsert do débito):

```typescript
  // Iniciar um novo atendimento sinaliza que qualquer in_progress órfão sem IA
  // de outro paciente foi abandonado — devolve esses créditos reservados.
  await reconcileOrphanConsultations(patientId)

  return {}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm test -- src/server/actions/consultation.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/actions/consultation.ts src/server/actions/consultation.test.ts
git commit -m "feat(atendimento): iniciar atendimento reconcilia orfaos de outros pacientes"
```

---

### Task 5: `reconcileStaleConsultations` (gatilho 2 — TTL) + hook no dashboard

**Files:**
- Modify: `src/server/actions/consultation.ts` (nova função `reconcileStaleConsultations`)
- Modify: `src/app/(app)/app/dashboard/page.tsx:45` (chamar antes do fetch)
- Test: `src/server/actions/consultation.test.ts` (novo `describe`)

Varre `in_progress` parados há mais de 24h e resolve (devolve sse `audio_attempts === 0`). Aqui inclui também os com IA usada (que viram terminal sem devolução) — 24h é folgado o bastante para não matar uma retomada legítima.

- [ ] **Step 1: Escrever o teste que falha**

```typescript
describe('reconcileStaleConsultations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    buildChain()
    mockGetServerUser.mockResolvedValue({ sub: 'user-1' })
    mockRefundCredit.mockResolvedValue(undefined)
    mockUpsert.mockResolvedValue({})
  })

  it('não faz nada quando não autenticado', async () => {
    mockGetServerUser.mockResolvedValue(null)
    await reconcileStaleConsultations()
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it('resolve in_progress parado há mais de 24h e devolve quando sem IA', async () => {
    chain.lt = vi.fn().mockResolvedValue({
      data: [{ patient_id: 'p-old', debit_source: 'paid', audio_attempts: 0, structured_anamnesis: { sections: [] } }],
      error: null,
    })
    await reconcileStaleConsultations()
    expect(chain.eq).toHaveBeenCalledWith('status', 'in_progress')
    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({ patient_id: 'p-old', status: 'abandoned' }), expect.anything())
    expect(mockRefundCredit).toHaveBeenCalledWith('user-1', 'paid')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test -- src/server/actions/consultation.test.ts`
Expected: FAIL (`reconcileStaleConsultations is not exported`)

- [ ] **Step 3: Implementar**

```typescript
const ORPHAN_TTL_HOURS = 24

export async function reconcileStaleConsultations(): Promise<void> {
  const user = await getServerUser()
  if (!user) return

  const cutoff = new Date(Date.now() - ORPHAN_TTL_HOURS * 60 * 60 * 1000).toISOString()
  const { data: stale } = await supabase
    .from('consultations')
    .select('patient_id, debit_source, audio_attempts, structured_anamnesis')
    .eq('user_id', user.sub)
    .eq('status', 'in_progress')
    .lt('updated_at', cutoff)

  for (const row of (stale ?? [])) {
    const { status, refundSource } = resolveTerminalState({
      audio_attempts: row.audio_attempts as number | null,
      structured_anamnesis: row.structured_anamnesis,
      debit_source: (row.debit_source ?? null) as 'bonus' | 'paid' | null,
    })
    await supabase.from('consultations').upsert(
      { user_id: user.sub, patient_id: row.patient_id as string, status, raw_transcript: null },
      { onConflict: 'user_id,patient_id' },
    )
    if (refundSource) {
      await CreditRepository.refundCredit(user.sub, refundSource)
    }
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm test -- src/server/actions/consultation.test.ts`
Expected: PASS

- [ ] **Step 5: Hook no dashboard**

Em `src/app/(app)/app/dashboard/page.tsx`, importar e chamar antes do `Promise.all` de fetch (linha ~45):

```typescript
import { reconcileStaleConsultations } from '@/server/actions/consultation'
// ...
  // Rede de proteção: ao abrir o dashboard, recupera créditos de atendimentos
  // in_progress órfãos parados há mais de 24h (aba fechada sem concluir).
  await reconcileStaleConsultations()

  const [patients, consultations, todayCount, weekCount, monthCount, storedUser] = await Promise.all([
```

- [ ] **Step 6: Commit**

```bash
git add src/server/actions/consultation.ts src/server/actions/consultation.test.ts "src/app/(app)/app/dashboard/page.tsx"
git commit -m "feat(atendimento): TTL 24h reconcilia orfaos no load do dashboard"
```

---

### Task 6: Validação integrada e docs

**Files:**
- Modify: `docs/architecture.md` (seção de créditos: documentar reconciliação e gatilhos)

- [ ] **Step 1: Rodar a suíte dos arquivos tocados**

Run: `pnpm test -- src/lib/consultation-state.test.ts src/server/actions/consultation.test.ts "src/app/(session)/app/consultation/[id]/consultation-page-flow.test.tsx"`
Expected: PASS em todos

- [ ] **Step 2: Atualizar `docs/architecture.md`**

Na seção "Créditos — Duas Carteiras + Estorno Simétrico", após o parágrafo da fonte de verdade, adicionar:

```markdown
**Reconciliação de órfãos (invariante: `in_progress` nunca fica preso).** Um atendimento só permanece `in_progress` enquanto for retomável. Dois gatilhos garantem o desfecho sem cron/websocket: (1) ao iniciar outro atendimento, `reconcileOrphanConsultations` resolve `in_progress` sem IA de outros pacientes; (2) no load do dashboard, `reconcileStaleConsultations` resolve `in_progress` parados há > 24h. A resolução usa `resolveTerminalState`: volta a `completed` se já havia anamnese (preserva histórico), senão `abandoned`; devolve crédito sse `debit_source != null && audio_attempts === 0`.
```

- [ ] **Step 3: Commit**

```bash
git add docs/architecture.md
git commit -m "docs(arquitetura): documenta reconciliacao de atendimento orfao"
```

---

## Notas de verificação (não são tasks)

- **Integração real (futuro):** os repositórios mexem em `consultations`/`credits` via `supabase`. Os testes acima são unitários (mock). Validar contra o banco com um teste de integração (`.integration.test.ts`) é recomendado antes de produção — fora do escopo deste plano se o ambiente de integração não estiver disponível.
- **Sem migration:** este plano NÃO altera schema (usa os 3 estados existentes e colunas já presentes). Nada para rodar em prod/dev.
- **Fase 2 (timeline de eventos):** plano separado. A tabela `activity_events` (append-only) e a nova `RecentActivity` rotulada vão consumir eventos emitidos nos pontos de resolução criados aqui.
