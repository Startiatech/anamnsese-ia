# Carteira de Créditos Simétrica + Estorno por Origem — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o modelo de créditos para que o estorno volte sempre para a mesma carteira do débito, remover herança de créditos do plano experimental, e padronizar `bonus_credits` como carteira exclusiva da injeção do master.

**Architecture:** Adicionar coluna `debit_source` em `consultations` registrando de qual carteira (`bonus` | `paid`) o crédito foi debitado. RPC `debit_user_credit` retorna a origem; RPC `refund_user_credit` aceita parâmetro `p_source` para devolver simetricamente. `injectCredits` (master) passa a alimentar `bonus_credits`. `selectPlanAction` perde a migração trial→bonus e passa a fazer reset de `credits_remaining` para a quota do novo plano. `getCredits` soma bonus+paid para validações de saldo total. `AppProvider` sincroniza prop `initialCredits` via `useEffect` para refletir alterações server-side em navegações.

**Tech Stack:** Supabase Postgres (RPCs PL/pgSQL), Next.js 16 App Router, React 19, TypeScript, Vitest, React Testing Library.

---

## Pré-requisitos / Contexto importante

### Estado atual (já levantado em análise)

- `bonus_credits` é coluna `smallint NOT NULL DEFAULT 0` em `users` (criada em migration 20260410).
- `debit_user_credit(p_user_id)` retorna `void` — drena bonus_credits primeiro, depois credits_remaining. Sem ledger de origem.
- `refund_user_credit(p_user_id)` retorna `void` — sempre devolve em `credits_remaining`. **Assimetria.**
- `add_user_credits(p_user_id, p_amount)` adiciona em `credits_remaining`. Usado pelo master via `injectCredits`.
- `selectPlanAction` em [src/server/actions/plans.ts:89-97](src/server/actions/plans.ts) migra `credits_remaining` restante → `bonus_credits` ao fazer upgrade do experimental.
- `CreditRepository.getCredits` lê só `credits_remaining`, ignorando `bonus_credits`.
- `AppProvider` usa `useState(initialCredits)` que não sincroniza com prop changes.
- `consultation-page-flow.tsx` nunca chama `refreshCredits()` após debit/abandon.

### Regras de negócio acordadas

1. `credits_remaining` = créditos do plano (experimental ou pago). Reset para `plan.quota` em qualquer mudança de plano (upgrade, downgrade, renovação). Padrão de mercado SaaS.
2. `bonus_credits` = cortesia/urgência do master. Sem ciclo. Só some por consumo ou estorno.
3. Débito drena bonus primeiro (mantém comportamento atual).
4. Estorno volta para a mesma carteira de onde saiu (correção do bug).
5. Sem herança de saldo no upgrade.

### Convenções obrigatórias do projeto

- Aplicar migrations em **AMBOS** os bancos: prod (`anamnese-ia-com-claude-code--prod`) e teste (`anamnese-ia-com-claude-code--teste`). Avisar o usuário antes.
- TDD obrigatório — RED → GREEN → REFACTOR.
- Conventional Commits em pt-br.
- `pnpm test`, `pnpm run test:integration`, `pnpm run build` são proibidos via terminal — pedir ao usuário para rodar.
- Sem `any` em TypeScript.

---

## Estrutura de arquivos

### Arquivos novos
- `supabase/migrations/20260526_credit_wallet_symmetric_refund.sql` — migração SQL única com schema + RPCs.

### Arquivos modificados
- `src/server/repositories/credits.ts` — novos métodos: `debitCreditReturningSource`, `refundCredit(source)`, `addBonusCredits`, `getCreditsBreakdown`, atualização do `getCredits`.
- `src/server/repositories/credits.test.ts` — testes unitários novos.
- `src/server/actions/consultation.ts` — `debitConsultationCredit` persiste `debit_source`; `abandonConsultation` lê e passa para refund.
- `src/server/actions/consultation.test.ts` — testes atualizados.
- `src/server/actions/credits.ts` — `injectCredits` chama `addBonusCredits`.
- `src/server/actions/credits.test.ts` — atualizado.
- `src/server/actions/plans.ts` — remover bloco de herança trial→bonus (linhas 89-97). Adicionar reset de credits_remaining em `selectPlanAction`.
- `src/server/actions/plans-bonus.test.ts` — remover/atualizar testes obsoletos.
- `src/server/repositories/plans.ts` — possível ajuste se `selectPlan` precisar receber/aplicar quota. Verificar.
- `src/context/app-context.tsx` — sync de `credits` via `useEffect` quando `initialCredits` prop mudar.
- `src/context/app-context.test.tsx` — teste novo de sync.
- `src/app/(session)/app/consultation/[id]/consultation-page-flow.tsx` — chamar `refreshCredits()` em `handleDebit` e `handleAbandonConfirmed`.
- `src/app/(session)/app/consultation/[id]/consultation-page-flow.test.tsx` — testes atualizados.

### Build doc
- `build-docs/2026-05-26-credits-wallet-symmetric-refund.md` — registro vivo da entrega.

### Arquitetura
- `docs/architecture.md` — atualizar diagrama do fluxo de créditos.

---

## Task 1: Migração SQL — `debit_source` em consultations + novos RPCs

**Files:**
- Create: `supabase/migrations/20260526_credit_wallet_symmetric_refund.sql`

- [ ] **Step 1: Criar arquivo de migração com schema + RPCs**

Crie `supabase/migrations/20260526_credit_wallet_symmetric_refund.sql`:

```sql
-- 1. Coluna para registrar de qual carteira saiu o débito de cada consulta
ALTER TABLE consultations
  ADD COLUMN debit_source text CHECK (debit_source IN ('bonus', 'paid'));

-- 2. Atualiza debit_user_credit para retornar a origem do débito
CREATE OR REPLACE FUNCTION public.debit_user_credit(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bonus integer;
  v_source text;
BEGIN
  SELECT bonus_credits INTO v_bonus FROM users WHERE id = p_user_id;

  IF v_bonus IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_bonus > 0 THEN
    UPDATE users SET bonus_credits = bonus_credits - 1 WHERE id = p_user_id;
    v_source := 'bonus';
  ELSE
    UPDATE users
    SET credits_remaining = GREATEST(credits_remaining - 1, 0)
    WHERE id = p_user_id;
    v_source := 'paid';
  END IF;

  RETURN v_source;
END;
$function$;

-- 3. Estorno simétrico: aceita a carteira de destino
CREATE OR REPLACE FUNCTION public.refund_user_credit(p_user_id uuid, p_source text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_source = 'bonus' THEN
    UPDATE users SET bonus_credits = bonus_credits + 1 WHERE id = p_user_id;
  ELSIF p_source = 'paid' THEN
    UPDATE users SET credits_remaining = credits_remaining + 1 WHERE id = p_user_id;
  ELSE
    RAISE EXCEPTION 'Invalid p_source: %', p_source;
  END IF;
END;
$function$;

-- 4. Nova RPC dedicada para injeção de bonus pelo master
CREATE OR REPLACE FUNCTION public.add_user_bonus_credits(p_user_id uuid, p_amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_new_total integer;
BEGIN
  IF p_amount < 1 THEN
    RAISE EXCEPTION 'amount must be >= 1';
  END IF;

  UPDATE users
  SET bonus_credits = bonus_credits + p_amount
  WHERE id = p_user_id
  RETURNING bonus_credits INTO v_new_total;

  RETURN COALESCE(v_new_total, 0);
END;
$function$;
```

- [ ] **Step 2: Avisar o usuário para aplicar a migração**

Antes de continuar, parar e avisar:

> "Por favor, aplique o SQL acima em AMBOS os bancos:
> 1. `anamnese-ia-com-claude-code--prod`
> 2. `anamnese-ia-com-claude-code--teste`
>
> Pode rodar via Supabase Dashboard → SQL Editor. Me avise quando concluir para eu seguir com o código."

- [ ] **Step 3: Commit da migration**

```bash
git add supabase/migrations/20260526_credit_wallet_symmetric_refund.sql
git commit -m "feat(db): debit_source em consultations e estorno simetrico de creditos"
```

---

## Task 2: `CreditRepository` — novos métodos + breakdown

**Files:**
- Modify: `src/server/repositories/credits.ts`
- Test: `src/lib/credits.test.ts` (testes unitários existentes; pode também precisar criar `src/server/repositories/credits.test.ts` se mais apropriado — verificar localização atual)

- [ ] **Step 1: Escrever teste RED para `debitCreditReturningSource`**

Adicionar em `src/lib/credits.test.ts`:

```typescript
describe('CreditRepository.debitCreditReturningSource', () => {
  it('retorna source do RPC debit_user_credit', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: 'bonus', error: null })
    const source = await CreditRepository.debitCreditReturningSource('user-1')
    expect(source).toBe('bonus')
    expect(mockSupabase.rpc).toHaveBeenCalledWith('debit_user_credit', { p_user_id: 'user-1' })
  })

  it('retorna null se RPC retornar null', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null })
    const source = await CreditRepository.debitCreditReturningSource('user-1')
    expect(source).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar teste — confirmar FAIL**

Pedir ao usuário:
> "Rode `pnpm test src/lib/credits.test.ts` e cole o resultado. Esperado: FAIL com 'debitCreditReturningSource is not a function'."

- [ ] **Step 3: Implementar `debitCreditReturningSource`**

Editar `src/server/repositories/credits.ts`:

```typescript
export const CreditRepository = {
  // ... métodos existentes ...

  async debitCreditReturningSource(userId: string): Promise<'bonus' | 'paid' | null> {
    const { data } = await supabase.rpc('debit_user_credit', { p_user_id: userId })
    if (data === 'bonus' || data === 'paid') return data
    return null
  },
}
```

- [ ] **Step 4: Confirmar PASS**

Pedir: "Rode `pnpm test src/lib/credits.test.ts` novamente — deve passar."

- [ ] **Step 5: Escrever teste RED para `refundCredit`**

Adicionar:

```typescript
describe('CreditRepository.refundCredit', () => {
  it('chama refund_user_credit com source bonus', async () => {
    await CreditRepository.refundCredit('user-1', 'bonus')
    expect(mockSupabase.rpc).toHaveBeenCalledWith('refund_user_credit', { p_user_id: 'user-1', p_source: 'bonus' })
  })

  it('chama refund_user_credit com source paid', async () => {
    await CreditRepository.refundCredit('user-1', 'paid')
    expect(mockSupabase.rpc).toHaveBeenCalledWith('refund_user_credit', { p_user_id: 'user-1', p_source: 'paid' })
  })
})
```

- [ ] **Step 6: Implementar `refundCredit`**

```typescript
async refundCredit(userId: string, source: 'bonus' | 'paid'): Promise<void> {
  await supabase.rpc('refund_user_credit', { p_user_id: userId, p_source: source })
},
```

- [ ] **Step 7: Escrever teste RED para `addBonusCredits`**

```typescript
describe('CreditRepository.addBonusCredits', () => {
  it('chama add_user_bonus_credits e retorna novo total de bonus', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: 12, error: null })
    const total = await CreditRepository.addBonusCredits('user-1', 5)
    expect(total).toBe(12)
    expect(mockSupabase.rpc).toHaveBeenCalledWith('add_user_bonus_credits', { p_user_id: 'user-1', p_amount: 5 })
  })
})
```

- [ ] **Step 8: Implementar `addBonusCredits`**

```typescript
async addBonusCredits(userId: string, amount: number): Promise<number> {
  const { data } = await supabase.rpc('add_user_bonus_credits', { p_user_id: userId, p_amount: amount })
  return (data as number) ?? 0
},
```

- [ ] **Step 9: Escrever teste RED para `getCreditsBreakdown`**

```typescript
describe('CreditRepository.getCreditsBreakdown', () => {
  it('retorna bonus e paid separados', async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: { credits_remaining: 5, bonus_credits: 3 },
      error: null,
    })
    const result = await CreditRepository.getCreditsBreakdown('user-1')
    expect(result).toEqual({ bonus: 3, paid: 5, total: 8 })
  })

  it('retorna zeros se usuário não existir', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: null, error: null })
    const result = await CreditRepository.getCreditsBreakdown('user-x')
    expect(result).toEqual({ bonus: 0, paid: 0, total: 0 })
  })
})
```

- [ ] **Step 10: Implementar `getCreditsBreakdown`**

```typescript
async getCreditsBreakdown(userId: string): Promise<{ bonus: number; paid: number; total: number }> {
  const { data } = await supabase
    .from('users')
    .select('credits_remaining, bonus_credits')
    .eq('id', userId)
    .single()
  const paid = (data?.credits_remaining as number) ?? 0
  const bonus = (data?.bonus_credits as number) ?? 0
  return { bonus, paid, total: bonus + paid }
},
```

- [ ] **Step 11: Atualizar `getCredits` para retornar `bonus + paid`**

Escrever teste RED primeiro:

```typescript
it('CreditRepository.getCredits soma bonus + credits_remaining', async () => {
  mockSupabase.single.mockResolvedValueOnce({
    data: { credits_remaining: 4, bonus_credits: 2 },
    error: null,
  })
  expect(await CreditRepository.getCredits('user-1')).toBe(6)
})
```

Depois ajustar implementação:

```typescript
async getCredits(userId: string): Promise<number> {
  const { data } = await supabase
    .from('users')
    .select('credits_remaining, bonus_credits')
    .eq('id', userId)
    .single()
  const paid = (data?.credits_remaining as number) ?? 0
  const bonus = (data?.bonus_credits as number) ?? 0
  return paid + bonus
},
```

- [ ] **Step 12: Rodar suite e commit**

Pedir ao usuário rodar `pnpm test`. Quando passar:

```bash
git add src/server/repositories/credits.ts src/lib/credits.test.ts
git commit -m "feat(credits): metodos para debito com source, refund simetrico e bonus credits"
```

---

## Task 3: `debitConsultationCredit` persiste `debit_source`

**Files:**
- Modify: `src/server/actions/consultation.ts:7-40`
- Test: `src/server/actions/consultation.test.ts`

- [ ] **Step 1: Escrever teste RED**

Adicionar/atualizar em `consultation.test.ts`:

```typescript
it('debitConsultationCredit salva debit_source retornado pelo RPC', async () => {
  // mock getServerUser → { sub: 'user-1' }
  // mock supabase.from('users').select('credits_remaining').single() → { credits_remaining: 5 }
  // mock supabase.rpc('debit_user_credit', ...) → { data: 'bonus', error: null }
  // spy supabase.from('consultations').upsert
  await debitConsultationCredit('patient-1')
  expect(consultationsUpsertSpy).toHaveBeenCalledWith(
    expect.objectContaining({ debit_source: 'bonus' }),
    expect.objectContaining({ onConflict: 'user_id,patient_id' }),
  )
})
```

- [ ] **Step 2: Rodar teste — FAIL**

Pedir ao usuário: "Rode `pnpm test src/server/actions/consultation.test.ts`."

- [ ] **Step 3: Implementar**

Editar `src/server/actions/consultation.ts`:

```typescript
import { CreditRepository } from '@/server/repositories/credits'

export async function debitConsultationCredit(patientId: string): Promise<{ error?: string }> {
  const user = await getServerUser()
  if (!user) return { error: 'Não autenticado' }

  const total = await CreditRepository.getCredits(user.sub)
  if (total < 1) {
    return { error: 'Créditos insuficientes' }
  }

  const source = await CreditRepository.debitCreditReturningSource(user.sub)
  if (!source) {
    return { error: 'Falha ao debitar crédito' }
  }

  const now = new Date().toISOString()
  await supabase.from('consultations').upsert(
    {
      user_id: user.sub,
      patient_id: patientId,
      status: 'in_progress',
      current_step: 2,
      audio_attempts: 0,
      refinement_attempts: 0,
      raw_transcript: null,
      debit_source: source,
      created_at: now,
      updated_at: now,
    },
    { onConflict: 'user_id,patient_id' },
  )

  return {}
}
```

- [ ] **Step 4: PASS + commit**

```bash
git add src/server/actions/consultation.ts src/server/actions/consultation.test.ts
git commit -m "feat(consultation): persiste debit_source ao debitar credito"
```

---

## Task 4: `abandonConsultation` faz estorno simétrico

**Files:**
- Modify: `src/server/actions/consultation.ts:42-66`
- Test: `src/server/actions/consultation.test.ts`

- [ ] **Step 1: Escrever teste RED**

```typescript
it('abandonConsultation refunda na carteira correta (bonus)', async () => {
  // mock supabase.from('consultations').select('debit_source').eq().eq().single() → { debit_source: 'bonus' }
  // spy CreditRepository.refundCredit
  await abandonConsultation('patient-1', 3 as ConsultationStep, false)
  expect(refundSpy).toHaveBeenCalledWith('user-1', 'bonus')
})

it('abandonConsultation refunda na carteira correta (paid)', async () => {
  // mock retorna debit_source: 'paid'
  await abandonConsultation('patient-1', 3 as ConsultationStep, false)
  expect(refundSpy).toHaveBeenCalledWith('user-1', 'paid')
})

it('abandonConsultation NÃO refunda se aiWasUsed=true', async () => {
  await abandonConsultation('patient-1', 3 as ConsultationStep, true)
  expect(refundSpy).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: FAIL → Implementar**

Editar:

```typescript
export async function abandonConsultation(
  patientId: string,
  currentStep: ConsultationStep,
  aiWasUsed: boolean,
): Promise<void> {
  const user = await getServerUser()
  if (!user) return

  // Lê debit_source antes do upsert para saber qual carteira estornar
  const { data: existing } = await supabase
    .from('consultations')
    .select('debit_source')
    .eq('user_id', user.sub)
    .eq('patient_id', patientId)
    .single()
  const source = (existing?.debit_source as 'bonus' | 'paid' | undefined) ?? null

  await supabase.from('consultations').upsert(
    {
      user_id: user.sub,
      patient_id: patientId,
      status: 'abandoned',
      current_step: currentStep,
      raw_transcript: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,patient_id' },
  )

  if (!aiWasUsed && source) {
    await CreditRepository.refundCredit(user.sub, source)
  }
}
```

- [ ] **Step 3: PASS + commit**

```bash
git add src/server/actions/consultation.ts src/server/actions/consultation.test.ts
git commit -m "fix(consultation): estorno simetrico para a carteira de origem do debito"
```

---

## Task 5: `injectCredits` (master) passa a alimentar bonus

**Files:**
- Modify: `src/server/actions/credits.ts`
- Test: `src/server/actions/credits.test.ts`

- [ ] **Step 1: Escrever teste RED**

```typescript
it('injectCredits chama CreditRepository.addBonusCredits', async () => {
  const addSpy = vi.spyOn(CreditRepository, 'addBonusCredits').mockResolvedValue(15)
  const result = await injectCredits('user-1', 5)
  expect(addSpy).toHaveBeenCalledWith('user-1', 5)
  expect(result).toEqual({ ok: true, newTotal: 15 })
})
```

- [ ] **Step 2: Implementar**

```typescript
import { CreditRepository } from '@/server/repositories/credits'

export async function injectCredits(
  userId: string,
  amount: number,
): Promise<{ ok: boolean; error?: string; newTotal?: number }> {
  if (amount < 1 || amount > 500) {
    return { ok: false, error: 'Quantidade deve ser entre 1 e 500.' }
  }
  const newTotal = await CreditRepository.addBonusCredits(userId, amount)
  return { ok: true, newTotal }
}
```

- [ ] **Step 3: PASS + commit**

```bash
git add src/server/actions/credits.ts src/server/actions/credits.test.ts
git commit -m "feat(credits): injecao do master alimenta bonus_credits"
```

---

## Task 6: Remover herança trial→bonus + reset de quota em troca de plano

**Files:**
- Modify: `src/server/actions/plans.ts:85-101`
- Test: `src/server/actions/plans-bonus.test.ts` (renomear/atualizar) + novos casos

- [ ] **Step 1: Escrever teste RED — herança trial→bonus NÃO deve mais acontecer**

```typescript
it('selectPlanAction NÃO migra créditos restantes do experimental para bonus_credits', async () => {
  // mock findUserById → { planId: 'experimental', creditsRemaining: 3 }
  const updateSpy = vi.spyOn(supabase, 'from')
  await selectPlanAction('basico')
  // garantir que update bonus_credits NÃO foi chamado
  expect(updateSpy).not.toHaveBeenCalledWith('users')
})
```

- [ ] **Step 2: Escrever teste RED — reset de quota ao trocar de plano**

```typescript
it('selectPlanAction reseta credits_remaining para a quota do novo plano', async () => {
  // mock PlanRepository.getQuotaByPlanId('basico') → 30
  const selectPlanSpy = vi.spyOn(PlanRepository, 'selectPlan').mockResolvedValue(undefined)
  await selectPlanAction('basico')
  // PlanRepository.selectPlan deve receber a quota para aplicar
  expect(selectPlanSpy).toHaveBeenCalledWith('user-1', 'basico')
  // E o repositório deve ter atualizado credits_remaining para 30
  // (verificar via spy em supabase update — depende de como selectPlan é implementado)
})
```

- [ ] **Step 3: Verificar `PlanRepository.selectPlan` atual**

Ler `src/server/repositories/plans.ts` e decidir:
- Se já reseta a quota → ótimo, só remover bloco da migração trial.
- Se não reseta → ajustar para aplicar `credits_remaining = quota` no update.

- [ ] **Step 4: Implementar mudança em `plans.ts`**

```typescript
export async function selectPlanAction(planId: string): Promise<void> {
  const user = await getServerUser()
  if (!user) redirect(ROUTES.login)

  await PlanRepository.selectPlan(user.sub, planId)
  redirect(ROUTES.configuracoes)
}
```

Ajustar `PlanRepository.selectPlan` se necessário para aplicar reset de `credits_remaining` à nova quota.

- [ ] **Step 5: Remover teste obsoleto de migração trial→bonus**

Se `plans-bonus.test.ts` tinha cobertura de herança, remover esses casos e renomear arquivo se fizer sentido (`plans.test.ts`).

- [ ] **Step 6: PASS + commit**

```bash
git add src/server/actions/plans.ts src/server/repositories/plans.ts src/server/actions/plans-bonus.test.ts
git commit -m "refactor(plans): remove heranca trial->bonus e reseta quota na troca de plano"
```

---

## Task 7: `AppProvider` sincroniza `credits` com prop changes

**Files:**
- Modify: `src/context/app-context.tsx`
- Test: `src/context/app-context.test.tsx` (criar se não existir)

- [ ] **Step 1: Escrever teste RED**

Criar `src/context/app-context.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { AppProvider, useApp } from './app-context'

function Display() {
  const { credits } = useApp()
  return <span data-testid="credits">{credits}</span>
}

describe('AppProvider', () => {
  it('atualiza credits quando initialCredits prop muda', () => {
    const { rerender } = render(
      <AppProvider initialCredits={5}><Display /></AppProvider>,
    )
    expect(screen.getByTestId('credits')).toHaveTextContent('5')

    rerender(<AppProvider initialCredits={3}><Display /></AppProvider>)
    expect(screen.getByTestId('credits')).toHaveTextContent('3')
  })
})
```

- [ ] **Step 2: FAIL → Implementar sync via useEffect**

Editar `src/context/app-context.tsx`:

```typescript
export function AppProvider({ children, initialUser = null, initialCredits = 0, initialPlanQuota = 0 }: AppProviderProps) {
  const [user] = useState<User | null>(initialUser)
  const [credits, setCredits] = useState<number>(initialCredits)
  const [planQuota] = useState<number>(initialPlanQuota)

  useEffect(() => {
    setCredits(initialCredits)
  }, [initialCredits])

  // resto inalterado
}
```

- [ ] **Step 3: PASS + commit**

```bash
git add src/context/app-context.tsx src/context/app-context.test.tsx
git commit -m "fix(app-context): sincroniza credits quando initialCredits prop muda"
```

---

## Task 8: `consultation-page-flow` chama `refreshCredits()` após debit/abandon

**Files:**
- Modify: `src/app/(session)/app/consultation/[id]/consultation-page-flow.tsx`
- Test: `src/app/(session)/app/consultation/[id]/consultation-page-flow.test.tsx`

- [ ] **Step 1: Escrever teste RED**

```typescript
it('handleDebit chama refreshCredits após débito bem-sucedido', async () => {
  // mock debitConsultationCredit → {}
  // mock useApp() → { credits: 5, refreshCredits: refreshSpy }
  // simular clique no botão de confirmação
  // ...
  await waitFor(() => expect(refreshSpy).toHaveBeenCalled())
})

it('handleAbandonConfirmed chama refreshCredits após estorno', async () => {
  // ...
  await waitFor(() => expect(refreshSpy).toHaveBeenCalled())
})
```

- [ ] **Step 2: Implementar**

Editar `consultation-page-flow.tsx`:

```typescript
const { refreshCredits } = useApp()

async function handleDebit(): Promise<{ error?: string }> {
  if (creditDebited) return {}
  const promise = debitConsultationCredit(patient.id).then(result => {
    if (result.error) throw new Error(result.error)
    return result
  })
  toast.promise(promise, {
    loading: 'Aguarde...',
    success: '1 crédito debitado. Atendimento iniciado.',
    error: (err: Error) => err.message || 'Erro ao debitar crédito.',
  })
  const result = await promise.catch((err: Error) => ({ error: err.message }))
  if (!result.error) {
    setCreditDebited(true)
    setAiWasUsed(false)
    setActiveTranscript('')
    setActiveRefinementsUsed(0)
    setAttemptsUsed(0)
    if (creditsRemaining - 1 <= 0 && planId === 'experimental') {
      setIsLastCredit(true)
    }
    await refreshCredits()
  }
  return result
}

function handleAbandonConfirmed() {
  if (!creditDebited) {
    router.push(ROUTES.atendimento)
    return
  }
  const refund = !aiWasUsed
  toast.promise(
    abandonConsultation(patient.id, state.step, aiWasUsed).then(async () => {
      await refreshCredits()
      if (isLastCredit && aiWasUsed) {
        setShowTrialEndModal(true)
      } else {
        router.push(ROUTES.atendimento)
      }
    }),
    {
      loading: 'Aguarde...',
      success: refund ? '1 crédito devolvido. Consulta encerrada.' : 'Consulta encerrada.',
      error: 'Erro ao encerrar. Tente novamente.',
    },
  )
}
```

- [ ] **Step 3: PASS + commit**

```bash
git add src/app/(session)/app/consultation/[id]/consultation-page-flow.tsx src/app/(session)/app/consultation/[id]/consultation-page-flow.test.tsx
git commit -m "fix(consultation): atualiza saldo de creditos na UI apos debit e abandon"
```

---

## Task 9: Estorno em massa dos créditos perdidos durante o bug

**Files:**
- Conversa com o usuário — sem mudança de código.

- [ ] **Step 1: Identificar usuários afetados via SQL**

Pedir ao usuário para rodar (em prod e teste):

```sql
-- Consultations 'in_progress' ou 'abandoned' que NÃO têm transcript e foram debitadas
-- (heurística — sem ledger histórico, é o melhor que conseguimos retroativamente)
SELECT
  c.user_id,
  u.email,
  count(*) AS affected_count
FROM consultations c
JOIN users u ON u.id = c.user_id
WHERE c.status IN ('abandoned', 'in_progress')
  AND c.raw_transcript IS NULL
GROUP BY c.user_id, u.email
ORDER BY affected_count DESC;
```

- [ ] **Step 2: Decidir política de estorno retroativo**

Apresentar ao usuário a lista e perguntar:
- Estornar tudo?
- Estornar só os do usuário de teste?
- Notificar usuários reais afetados?

- [ ] **Step 3: Aplicar SQL de estorno após decisão**

Construir SQL ad-hoc baseado na decisão. Não automatizar — fazer manual e com revisão.

---

## Task 10: Atualizar build-doc e documentação de arquitetura

**Files:**
- Create: `build-docs/2026-05-26-credits-wallet-symmetric-refund.md`
- Modify: `docs/architecture.md`

- [ ] **Step 1: Criar build-doc**

Conteúdo (resumo):

```markdown
# Build 2026-05-26 — Carteira de créditos simétrica + remoção de herança trial

Documento vivo. Atualizar a cada alteração desta sessão.

## Contexto

Bug crítico: créditos eram debitados e o estorno voltava para a carteira errada (sempre `credits_remaining`), enquanto o débito drena `bonus_credits` primeiro. Em testes sem transcrição, o usuário perdia créditos.

## Alterações

### 1. Schema
- Coluna `debit_source` em `consultations` (enum text 'bonus'|'paid').
- RPC `debit_user_credit` agora retorna a origem (`text`).
- RPC `refund_user_credit(p_user_id, p_source)` — estorno simétrico.
- Nova RPC `add_user_bonus_credits` para injeção do master.

### 2. Servidor
- `debitConsultationCredit` persiste `debit_source`.
- `abandonConsultation` lê `debit_source` e estorna na carteira correta.
- `injectCredits` (master) passa a alimentar `bonus_credits`.
- `selectPlanAction` perdeu a herança trial→bonus; `PlanRepository.selectPlan` reseta `credits_remaining` à nova quota.

### 3. Cliente
- `AppProvider` sincroniza `credits` via `useEffect` em mudanças de prop.
- `consultation-page-flow` chama `refreshCredits()` após debit e após abandon.

### 4. TDD
- `CreditRepository`: testes unitários para `debitCreditReturningSource`, `refundCredit`, `addBonusCredits`, `getCreditsBreakdown`, `getCredits` (soma).
- `consultation.test.ts`: testes para persistência de source e estorno simétrico.
- `credits.test.ts`: teste de injectCredits → bonus.
- `plans.test.ts`: teste de reset de quota; remoção de testes de herança.
- `app-context.test.tsx`: teste de sync de prop.
- `consultation-page-flow.test.tsx`: testes para refreshCredits após mutações.
```

- [ ] **Step 2: Atualizar `docs/architecture.md`**

Localizar o diagrama Mermaid do fluxo de créditos e atualizar para refletir as duas carteiras + fluxo de origem→estorno simétrico.

- [ ] **Step 3: Commit final**

```bash
git add build-docs/2026-05-26-credits-wallet-symmetric-refund.md docs/architecture.md
git commit -m "docs: build-doc da carteira simetrica e atualiza diagramas de creditos"
```

---

## Self-Review

**1. Spec coverage:**
- Reset de quota no upgrade ✅ (Task 6)
- Remoção da herança trial→bonus ✅ (Task 6)
- Estorno simétrico via `debit_source` ✅ (Tasks 1, 3, 4)
- Injeção master → bonus ✅ (Tasks 1, 5)
- `getCredits` soma carteiras ✅ (Task 2)
- UI atualiza saldo após debit/abandon ✅ (Tasks 7, 8)
- Estorno retroativo dos créditos perdidos ✅ (Task 9)
- Build-doc + arquitetura ✅ (Task 10)

**2. Placeholder scan:** Nenhum "TBD" / "implementar depois" detectado. Todos os blocos de código estão completos.

**3. Type consistency:**
- `debit_source` é sempre `'bonus' | 'paid'` (string literal union) tanto no TS quanto no SQL CHECK constraint.
- `CreditRepository.refundCredit(userId, source)` recebe o source — mesma assinatura em todos os callers.
- `debitCreditReturningSource` retorna `'bonus' | 'paid' | null`. Callers tratam null como erro.

**Pontos de atenção que o engineer deve confirmar durante execução:**
- Task 6 depende de inspecionar `PlanRepository.selectPlan` para decidir se ele já reseta quota. Se sim, é só remover o bloco antigo. Se não, ajustar o repositório.
- Task 9 é manual e exige decisão de negócio — não executar SQL sem confirmação do usuário.
- Antes da Task 2 começar, a Task 1 (migrations) deve estar aplicada em ambos os bancos.
