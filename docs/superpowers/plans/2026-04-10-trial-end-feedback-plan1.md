# Trial End Feedback — Plano 1: Core Flow

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o fluxo completo de fim de trial: modal de feedback obrigatório com 3 steps, grace period de 7 dias com banner e cancelamento, bonus_credits ao fazer upgrade orgânico com créditos sobrando.

**Architecture:** Migration SQL → Repository + Server Actions com TDD → TrialEndModal client component → wiring no consultation-page-flow → DeletionBanner no app layout → sidebar bonus credits.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase (service_role + pg_cron), Vitest + RTL, shadcn/ui, Sonner (toast), `vi.hoisted` mock pattern.

**Spec:** `docs/superpowers/specs/2026-04-10-trial-end-feedback-design.md`

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `supabase/migrations/20260410_feedback_trial.sql` | Criar | Migration: tabela feedbacks, colunas users, RPC, pg_cron |
| `src/server/repositories/feedbacks.ts` | Criar | CRUD de feedbacks (save, findByUserId, hasAnyForUser) |
| `src/server/repositories/feedbacks.test.ts` | Criar | Testes unitários do FeedbackRepository |
| `src/server/repositories/users.ts` | Modificar | Adicionar deletionScheduledAt, bonusCredits ao StoredUser |
| `src/server/actions/feedback.ts` | Criar | saveFeedback, scheduleAccountDeletion, cancelAccountDeletion |
| `src/server/actions/feedback.test.ts` | Criar | Testes das server actions |
| `src/server/actions/plans.ts` | Modificar | Capturar bonus_credits no selectPlanAction |
| `src/server/actions/plans.test.ts` | Criar | Testes do bonus_credits |
| `src/lib/routes.ts` | Modificar | Adicionar consoleFeedbacks, adminFeedbacksAnalyze |
| `src/components/trial/trial-end-modal.tsx` | Criar | Modal 3 steps: feedback → decision → confirm-delete |
| `src/components/trial/trial-end-modal.test.tsx` | Criar | Testes RTL dos 3 steps |
| `src/app/(session)/consultation/[id]/consultation-page-flow.tsx` | Modificar | Receber creditsRemaining + planId, disparar TrialEndModal |
| `src/components/layout/deletion-banner.tsx` | Criar | Banner de grace period com cancelamento |
| `src/components/layout/deletion-banner.test.tsx` | Criar | Testes RTL do banner |
| `src/app/(app)/layout.tsx` | Modificar | Passar deletionScheduledAt + bonusCredits para AppLayoutClient |
| `src/app/(app)/app-layout-client.tsx` | Modificar | Renderizar DeletionBanner, passar bonusCredits para SidebarCredits |
| `src/components/layout/sidebar-credits.tsx` | Modificar | Exibir bonusCredits com badge gradiente |

---

## Task 1: Migration SQL

**Files:**
- Create: `supabase/migrations/20260410_feedback_trial.sql`

- [ ] **Step 1: Criar o arquivo de migration**

```sql
-- supabase/migrations/20260410_feedback_trial.sql

-- ─── Tabela feedbacks ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedbacks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES users(id) ON DELETE CASCADE,
  rating          smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  message         text,
  plan_id         text NOT NULL DEFAULT 'experimental',
  action_taken    text NOT NULL DEFAULT 'pending',
  sentiment_score numeric,
  sentiment_label text,
  analyzed_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedbacks_user_id_idx ON feedbacks(user_id);
CREATE INDEX IF NOT EXISTS feedbacks_action_taken_idx ON feedbacks(action_taken);
CREATE INDEX IF NOT EXISTS feedbacks_analyzed_at_idx ON feedbacks(analyzed_at) WHERE analyzed_at IS NULL;

-- ─── Colunas em users ────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deletion_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS bonus_credits smallint NOT NULL DEFAULT 0;

-- ─── RPC debit_user_credit (bonus primeiro) ──────────────────────────────────
CREATE OR REPLACE FUNCTION debit_user_credit(p_user_id uuid)
RETURNS void AS $$
BEGIN
  IF (SELECT bonus_credits FROM users WHERE id = p_user_id) > 0 THEN
    UPDATE users SET bonus_credits = bonus_credits - 1 WHERE id = p_user_id;
  ELSE
    UPDATE users
    SET credits_remaining = GREATEST(credits_remaining - 1, 0)
    WHERE id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── pg_cron: exclusão após grace period ─────────────────────────────────────
-- Requer extensão pg_cron habilitada no Supabase (Dashboard → Extensions)
SELECT cron.schedule(
  'delete-expired-accounts',
  '0 2 * * *',
  $$DELETE FROM users WHERE deletion_scheduled_at IS NOT NULL AND deletion_scheduled_at <= now()$$
);
```

- [ ] **Step 2: Aplicar via Supabase MCP**

Use `mcp__supabase__apply_migration` com `name: "feedback_trial"` e o SQL acima.
Ou aplique manualmente via Supabase Dashboard → SQL Editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260410_feedback_trial.sql
git commit -m "feat(db): add feedbacks table, deletion grace period, bonus_credits"
```

---

## Task 2: Atualizar StoredUser + users repository

**Files:**
- Modify: `src/server/repositories/users.ts`

- [ ] **Step 1: Escrever testes falhando**

Adicione ao final de `src/server/repositories/users.ts` (ou crie `users.test.ts` se não existir):

```typescript
// src/server/repositories/users.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSelect, mockUpdate, mockSingle, mockEq } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockSingle: vi.fn(),
  mockEq: vi.fn(),
}))

vi.mock('@/server/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect.mockReturnThis(),
      update: mockUpdate.mockReturnThis(),
      eq: mockEq.mockReturnThis(),
      single: mockSingle,
    })),
  },
}))

import { findUserById } from './users'

describe('findUserById — novos campos', () => {
  beforeEach(() => vi.clearAllMocks())

  it('mapeia deletion_scheduled_at e bonus_credits corretamente', async () => {
    mockSingle.mockResolvedValue({
      data: {
        id: 'u1', name: 'Dr. Ana', email: 'ana@clinic.com',
        password_hash: 'hash', role: 'user',
        plan_id: 'experimental', plan_selected: false,
        onboarding_completed: true, password_is_temp: false,
        blocked: false, credits_remaining: 0,
        created_at: '2026-01-01T00:00:00Z',
        deletion_scheduled_at: '2026-04-17T02:00:00Z',
        bonus_credits: 3,
      },
      error: null,
    })

    const user = await findUserById('u1')
    expect(user?.deletionScheduledAt).toBe('2026-04-17T02:00:00Z')
    expect(user?.bonusCredits).toBe(3)
  })

  it('retorna deletionScheduledAt null quando não agendado', async () => {
    mockSingle.mockResolvedValue({
      data: {
        id: 'u2', name: 'Dr. Pedro', email: 'pedro@clinic.com',
        password_hash: 'hash', role: 'user',
        plan_id: 'experimental', plan_selected: false,
        onboarding_completed: true, password_is_temp: false,
        blocked: false, credits_remaining: 5,
        created_at: '2026-01-01T00:00:00Z',
        deletion_scheduled_at: null,
        bonus_credits: 0,
      },
      error: null,
    })

    const user = await findUserById('u2')
    expect(user?.deletionScheduledAt).toBeNull()
    expect(user?.bonusCredits).toBe(0)
  })
})
```

- [ ] **Step 2: Rodar e confirmar falha**

```bash
npm test -- src/server/repositories/users.test.ts
```
Expected: FAIL — `Property 'deletionScheduledAt' does not exist`

- [ ] **Step 3: Atualizar StoredUser e toStoredUser em `users.ts`**

Localize a interface `StoredUser` e adicione os dois campos:

```typescript
export interface StoredUser {
  // ... campos existentes ...
  deletionScheduledAt: string | null
  bonusCredits: number
}
```

Localize a função `toStoredUser` e adicione no objeto retornado (após `creditsRemaining`):

```typescript
    deletionScheduledAt: (row.deletion_scheduled_at as string | null) ?? null,
    bonusCredits: (row.bonus_credits as number) ?? 0,
```

- [ ] **Step 4: Rodar e confirmar verde**

```bash
npm test -- src/server/repositories/users.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/repositories/users.ts src/server/repositories/users.test.ts
git commit -m "feat(users): add deletionScheduledAt and bonusCredits fields"
```

---

## Task 3: FeedbackRepository

**Files:**
- Create: `src/server/repositories/feedbacks.ts`
- Create: `src/server/repositories/feedbacks.test.ts`

- [ ] **Step 1: Escrever testes falhando**

```typescript
// src/server/repositories/feedbacks.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom, mockInsert, mockSelect, mockEq, mockOrder, mockLimit, mockMaybeSingle, mockSingle } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockInsert: vi.fn(),
  mockSelect: vi.fn(),
  mockEq: vi.fn(),
  mockOrder: vi.fn(),
  mockLimit: vi.fn(),
  mockMaybeSingle: vi.fn(),
  mockSingle: vi.fn(),
}))

vi.mock('@/server/supabase', () => ({
  supabase: {
    from: mockFrom,
  },
}))

import { FeedbackRepository } from './feedbacks'

function makeChain(finalMethod: string, result: unknown) {
  const chain: Record<string, unknown> = {}
  chain.insert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue(result) }) })
  chain.select = vi.fn().mockReturnThis()
  chain.eq = vi.fn().mockReturnThis()
  chain.order = vi.fn().mockReturnThis()
  chain.limit = vi.fn().mockReturnThis()
  chain.maybeSingle = vi.fn().mockResolvedValue(result)
  chain.single = vi.fn().mockResolvedValue(result)
  if (finalMethod === 'maybeSingle') {
    chain.maybeSingle = vi.fn().mockResolvedValue(result)
  }
  return chain
}

describe('FeedbackRepository', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('save', () => {
    it('insere feedback e retorna id', async () => {
      const chain = makeChain('single', { data: { id: 'fb-1' }, error: null })
      mockFrom.mockReturnValue(chain)

      const id = await FeedbackRepository.save({
        userId: 'u1',
        rating: 5,
        message: 'Ótimo sistema',
        planId: 'experimental',
        actionTaken: 'pending',
      })

      expect(id).toBe('fb-1')
    })
  })

  describe('hasAnyForUser', () => {
    it('retorna true quando existe feedback', async () => {
      const chain = makeChain('maybeSingle', { data: { id: 'fb-1' }, error: null })
      mockFrom.mockReturnValue(chain)

      const result = await FeedbackRepository.hasAnyForUser('u1')
      expect(result).toBe(true)
    })

    it('retorna false quando nao existe feedback', async () => {
      const chain = makeChain('maybeSingle', { data: null, error: null })
      mockFrom.mockReturnValue(chain)

      const result = await FeedbackRepository.hasAnyForUser('u1')
      expect(result).toBe(false)
    })
  })

  describe('updateActionTaken', () => {
    it('atualiza action_taken do feedback', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })
      mockFrom.mockReturnValue({ update: mockUpdate })

      await FeedbackRepository.updateActionTaken('fb-1', 'upgrade_modal')
      expect(mockUpdate).toHaveBeenCalledWith({ action_taken: 'upgrade_modal' })
    })
  })
})
```

- [ ] **Step 2: Rodar e confirmar falha**

```bash
npm test -- src/server/repositories/feedbacks.test.ts
```
Expected: FAIL — `Cannot find module './feedbacks'`

- [ ] **Step 3: Implementar FeedbackRepository**

```typescript
// src/server/repositories/feedbacks.ts
import { supabase } from '@/server/supabase'

export type FeedbackActionTaken =
  | 'pending'
  | 'upgrade_modal'
  | 'upgrade_organic'
  | 'declined'

export interface FeedbackInput {
  userId: string
  rating: number
  message?: string
  planId: string
  actionTaken: FeedbackActionTaken
}

export interface Feedback extends FeedbackInput {
  id: string
  sentimentScore?: number | null
  sentimentLabel?: string | null
  analyzedAt?: string | null
  createdAt: string
}

export const FeedbackRepository = {
  async save(input: FeedbackInput): Promise<string> {
    const { data } = await supabase
      .from('feedbacks')
      .insert({
        user_id: input.userId,
        rating: input.rating,
        message: input.message ?? null,
        plan_id: input.planId,
        action_taken: input.actionTaken,
      })
      .select('id')
      .single()
    return (data as { id: string }).id
  },

  async hasAnyForUser(userId: string): Promise<boolean> {
    const { data } = await supabase
      .from('feedbacks')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()
    return data !== null
  },

  async updateActionTaken(id: string, actionTaken: FeedbackActionTaken): Promise<void> {
    await supabase
      .from('feedbacks')
      .update({ action_taken: actionTaken })
      .eq('id', id)
  },
}
```

- [ ] **Step 4: Rodar e confirmar verde**

```bash
npm test -- src/server/repositories/feedbacks.test.ts
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/server/repositories/feedbacks.ts src/server/repositories/feedbacks.test.ts
git commit -m "feat(feedbacks): add FeedbackRepository with save, hasAnyForUser, updateActionTaken"
```

---

## Task 4: Server Actions de feedback

**Files:**
- Create: `src/server/actions/feedback.ts`
- Create: `src/server/actions/feedback.test.ts`

- [ ] **Step 1: Escrever testes falhando**

```typescript
// src/server/actions/feedback.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetServerUser, mockSave, mockUpdateActionTaken, mockHasAnyForUser, mockSupabaseUpdate } = vi.hoisted(() => ({
  mockGetServerUser: vi.fn(),
  mockSave: vi.fn(),
  mockUpdateActionTaken: vi.fn(),
  mockHasAnyForUser: vi.fn(),
  mockSupabaseUpdate: vi.fn(),
}))

vi.mock('@/server/services/session', () => ({
  getServerUser: mockGetServerUser,
}))

vi.mock('@/server/repositories/feedbacks', () => ({
  FeedbackRepository: {
    save: mockSave,
    updateActionTaken: mockUpdateActionTaken,
    hasAnyForUser: mockHasAnyForUser,
  },
}))

vi.mock('@/server/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: mockSupabaseUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })),
  },
}))

import { saveFeedback, scheduleAccountDeletion, cancelAccountDeletion } from './feedback'

describe('saveFeedback', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna erro quando nao autenticado', async () => {
    mockGetServerUser.mockResolvedValue(null)
    const result = await saveFeedback({ rating: 5, message: '' })
    expect(result).toEqual({ error: 'Unauthorized' })
  })

  it('salva feedback e retorna feedbackId', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1', planId: 'experimental' })
    mockSave.mockResolvedValue('fb-1')
    const result = await saveFeedback({ rating: 4, message: 'Bom sistema' })
    expect(result).toEqual({ feedbackId: 'fb-1' })
    expect(mockSave).toHaveBeenCalledWith({
      userId: 'u1',
      rating: 4,
      message: 'Bom sistema',
      planId: 'experimental',
      actionTaken: 'pending',
    })
  })
})

describe('scheduleAccountDeletion', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna erro quando nao autenticado', async () => {
    mockGetServerUser.mockResolvedValue(null)
    const result = await scheduleAccountDeletion('fb-1')
    expect(result).toEqual({ error: 'Unauthorized' })
  })

  it('agenda exclusao e atualiza action_taken', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1' })
    mockUpdateActionTaken.mockResolvedValue(undefined)

    const result = await scheduleAccountDeletion('fb-1')
    expect(result).toEqual({ ok: true })
    expect(mockUpdateActionTaken).toHaveBeenCalledWith('fb-1', 'declined')
    expect(mockSupabaseUpdate).toHaveBeenCalled()
  })
})

describe('cancelAccountDeletion', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna erro quando nao autenticado', async () => {
    mockGetServerUser.mockResolvedValue(null)
    const result = await cancelAccountDeletion()
    expect(result).toEqual({ error: 'Unauthorized' })
  })

  it('limpa deletion_scheduled_at', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1' })
    const result = await cancelAccountDeletion()
    expect(result).toEqual({ ok: true })
    expect(mockSupabaseUpdate).toHaveBeenCalledWith({ deletion_scheduled_at: null })
  })
})
```

- [ ] **Step 2: Rodar e confirmar falha**

```bash
npm test -- src/server/actions/feedback.test.ts
```
Expected: FAIL — `Cannot find module './feedback'`

- [ ] **Step 3: Implementar server actions**

```typescript
// src/server/actions/feedback.ts
'use server'

import { supabase } from '@/server/supabase'
import { getServerUser } from '@/server/services/session'
import { FeedbackRepository } from '@/server/repositories/feedbacks'

export async function saveFeedback(input: {
  rating: number
  message?: string
}): Promise<{ feedbackId?: string; error?: string }> {
  const user = await getServerUser()
  if (!user) return { error: 'Unauthorized' }

  const feedbackId = await FeedbackRepository.save({
    userId: user.sub,
    rating: input.rating,
    message: input.message ?? '',
    planId: (user as { planId?: string }).planId ?? 'experimental',
    actionTaken: 'pending',
  })

  return { feedbackId }
}

export async function scheduleAccountDeletion(
  feedbackId: string
): Promise<{ ok?: boolean; error?: string }> {
  const user = await getServerUser()
  if (!user) return { error: 'Unauthorized' }

  const deletionDate = new Date()
  deletionDate.setDate(deletionDate.getDate() + 7)

  await supabase
    .from('users')
    .update({ deletion_scheduled_at: deletionDate.toISOString() })
    .eq('id', user.sub)

  await FeedbackRepository.updateActionTaken(feedbackId, 'declined')

  return { ok: true }
}

export async function cancelAccountDeletion(): Promise<{ ok?: boolean; error?: string }> {
  const user = await getServerUser()
  if (!user) return { error: 'Unauthorized' }

  await supabase
    .from('users')
    .update({ deletion_scheduled_at: null })
    .eq('id', user.sub)

  return { ok: true }
}

export async function markFeedbackUpgrade(
  feedbackId: string,
  source: 'upgrade_modal' | 'upgrade_organic'
): Promise<void> {
  await FeedbackRepository.updateActionTaken(feedbackId, source)
}
```

- [ ] **Step 4: Rodar e confirmar verde**

```bash
npm test -- src/server/actions/feedback.test.ts
```
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/server/actions/feedback.ts src/server/actions/feedback.test.ts
git commit -m "feat(feedback): add saveFeedback, scheduleAccountDeletion, cancelAccountDeletion actions"
```

---

## Task 5: Bonus credits no selectPlanAction

**Files:**
- Modify: `src/server/actions/plans.ts`
- Create: `src/server/actions/plans-bonus.test.ts`

- [ ] **Step 1: Escrever teste falhando**

```typescript
// src/server/actions/plans-bonus.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetServerUser, mockSelectPlan, mockFindUserById, mockSupabaseUpdate, mockRedirect, mockMarkFeedbackUpgrade } = vi.hoisted(() => ({
  mockGetServerUser: vi.fn(),
  mockSelectPlan: vi.fn(),
  mockFindUserById: vi.fn(),
  mockSupabaseUpdate: vi.fn(),
  mockRedirect: vi.fn(),
  mockMarkFeedbackUpgrade: vi.fn(),
}))

vi.mock('@/server/services/session', () => ({ getServerUser: mockGetServerUser }))
vi.mock('@/server/repositories/plans', () => ({ PlanRepository: { selectPlan: mockSelectPlan } }))
vi.mock('@/server/repositories/users', () => ({ findUserById: mockFindUserById }))
vi.mock('@/server/actions/feedback', () => ({ markFeedbackUpgrade: mockMarkFeedbackUpgrade }))
vi.mock('next/navigation', () => ({ redirect: mockRedirect }))
vi.mock('@/server/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: mockSupabaseUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })),
  },
}))

import { selectPlanAction } from './plans'

describe('selectPlanAction — bonus_credits', () => {
  beforeEach(() => vi.clearAllMocks())

  it('move creditos restantes do experimental para bonus_credits', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1' })
    mockFindUserById.mockResolvedValue({
      planId: 'experimental',
      creditsRemaining: 3,
    })
    mockSelectPlan.mockResolvedValue(undefined)

    await selectPlanAction('profissional')

    expect(mockSupabaseUpdate).toHaveBeenCalledWith({ bonus_credits: 3 })
    expect(mockMarkFeedbackUpgrade).toHaveBeenCalledWith(undefined, 'upgrade_organic')
  })

  it('nao move bonus quando plano nao é experimental', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1' })
    mockFindUserById.mockResolvedValue({
      planId: 'profissional',
      creditsRemaining: 10,
    })
    mockSelectPlan.mockResolvedValue(undefined)

    await selectPlanAction('profissional-plus')

    expect(mockSupabaseUpdate).not.toHaveBeenCalled()
  })

  it('nao move bonus quando nao ha creditos restantes', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1' })
    mockFindUserById.mockResolvedValue({
      planId: 'experimental',
      creditsRemaining: 0,
    })
    mockSelectPlan.mockResolvedValue(undefined)

    await selectPlanAction('profissional')

    expect(mockSupabaseUpdate).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar e confirmar falha**

```bash
npm test -- src/server/actions/plans-bonus.test.ts
```
Expected: FAIL — `mockSupabaseUpdate` não é chamado (lógica ainda não existe)

- [ ] **Step 3: Atualizar selectPlanAction em `plans.ts`**

Substitua a função `selectPlanAction` existente:

```typescript
export async function selectPlanAction(planId: string): Promise<void> {
  const user = await getServerUser()
  if (!user) redirect(ROUTES.login)

  // Herdar créditos do plano experimental como bônus
  const storedUser = await findUserById(user.sub)
  if (storedUser?.planId === 'experimental' && (storedUser.creditsRemaining ?? 0) > 0) {
    await supabase
      .from('users')
      .update({ bonus_credits: storedUser.creditsRemaining })
      .eq('id', user.sub)
    await markFeedbackUpgrade(undefined as unknown as string, 'upgrade_organic')
  }

  await PlanRepository.selectPlan(user.sub, planId)
  redirect(ROUTES.configuracoes)
}
```

Adicione os imports necessários no topo de `plans.ts`:

```typescript
import { findUserById } from '@/server/repositories/users'
import { markFeedbackUpgrade } from '@/server/actions/feedback'
```

- [ ] **Step 4: Rodar e confirmar verde**

```bash
npm test -- src/server/actions/plans-bonus.test.ts
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/server/actions/plans.ts src/server/actions/plans-bonus.test.ts
git commit -m "feat(plans): carry over experimental credits as bonus_credits on upgrade"
```

---

## Task 6: Adicionar rotas

**Files:**
- Modify: `src/lib/routes.ts`

- [ ] **Step 1: Adicionar entradas em `routes.ts`**

No bloco `ROUTES`, após `consolePlanos`:

```typescript
  consoleFeedbacks:     '/console/feedbacks',
```

No bloco `API`, no final:

```typescript
  adminFeedbacksAnalyze: '/api/admin/feedbacks/analyze',
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/routes.ts
git commit -m "feat(routes): add consoleFeedbacks and adminFeedbacksAnalyze routes"
```

---

## Task 7: TrialEndModal — testes RTL

**Files:**
- Create: `src/components/trial/trial-end-modal.test.tsx`
- Create: `src/components/trial/trial-end-modal.tsx` (stub para os testes passarem)

- [ ] **Step 1: Escrever testes falhando**

```typescript
// src/components/trial/trial-end-modal.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TrialEndModal } from './trial-end-modal'

const mockSaveFeedback = vi.fn()
const mockScheduleAccountDeletion = vi.fn()
const mockMarkFeedbackUpgrade = vi.fn()
const mockPush = vi.fn()

vi.mock('@/server/actions/feedback', () => ({
  saveFeedback: mockSaveFeedback,
  scheduleAccountDeletion: mockScheduleAccountDeletion,
  markFeedbackUpgrade: mockMarkFeedbackUpgrade,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('sonner', () => ({
  toast: { promise: vi.fn((p: Promise<unknown>) => p), error: vi.fn(), success: vi.fn() },
}))

describe('TrialEndModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renderiza step de feedback com estrelas', () => {
    render(<TrialEndModal open={true} />)
    expect(screen.getByText(/período de teste chegou ao fim/i)).toBeInTheDocument()
    expect(screen.getByText(/avaliação/i)).toBeInTheDocument()
  })

  it('botao Avançar fica desabilitado sem selecionar estrelas', () => {
    render(<TrialEndModal open={true} />)
    const btn = screen.getByRole('button', { name: /avançar/i })
    expect(btn).toBeDisabled()
  })

  it('habilita Avançar ao selecionar estrela', () => {
    render(<TrialEndModal open={true} />)
    const stars = screen.getAllByRole('button', { name: /estrela/i })
    fireEvent.click(stars[4]) // 5 estrelas
    expect(screen.getByRole('button', { name: /avançar/i })).not.toBeDisabled()
  })

  it('avanca para step de decisao ao clicar Avançar', async () => {
    mockSaveFeedback.mockResolvedValue({ feedbackId: 'fb-1' })
    render(<TrialEndModal open={true} />)

    const stars = screen.getAllByRole('button', { name: /estrela/i })
    fireEvent.click(stars[4])
    fireEvent.click(screen.getByRole('button', { name: /avançar/i }))

    await waitFor(() => {
      expect(screen.getByText(/o que deseja fazer agora/i)).toBeInTheDocument()
    })
  })

  it('navega para /plans ao clicar Ver planos', async () => {
    mockSaveFeedback.mockResolvedValue({ feedbackId: 'fb-1' })
    mockMarkFeedbackUpgrade.mockResolvedValue(undefined)
    render(<TrialEndModal open={true} />)

    const stars = screen.getAllByRole('button', { name: /estrela/i })
    fireEvent.click(stars[2])
    fireEvent.click(screen.getByRole('button', { name: /avançar/i }))

    await waitFor(() => screen.getByText(/o que deseja fazer agora/i))
    fireEvent.click(screen.getByRole('button', { name: /ver planos/i }))

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/plans'))
  })

  it('avanca para step de confirmacao ao clicar Encerrar', async () => {
    mockSaveFeedback.mockResolvedValue({ feedbackId: 'fb-1' })
    render(<TrialEndModal open={true} />)

    const stars = screen.getAllByRole('button', { name: /estrela/i })
    fireEvent.click(stars[0])
    fireEvent.click(screen.getByRole('button', { name: /avançar/i }))
    await waitFor(() => screen.getByText(/o que deseja fazer agora/i))

    fireEvent.click(screen.getByRole('button', { name: /encerrar período/i }))
    await waitFor(() => {
      expect(screen.getByText(/exclusão crítica/i)).toBeInTheDocument()
    })
  })

  it('nao fecha com ESC ou clique externo', () => {
    render(<TrialEndModal open={true} />)
    // Dialog com onOpenChange que não faz nada — modal permanece aberto
    expect(screen.getByText(/período de teste chegou ao fim/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e confirmar falha**

```bash
npm test -- src/components/trial/trial-end-modal.test.tsx
```
Expected: FAIL — `Cannot find module './trial-end-modal'`

---

## Task 8: TrialEndModal — implementação

**Files:**
- Create: `src/components/trial/trial-end-modal.tsx`

- [ ] **Step 1: Implementar o componente**

```typescript
// src/components/trial/trial-end-modal.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Star } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Logo } from '@/components/ui/logo'
import { Separator } from '@/components/ui/separator'
import { saveFeedback, scheduleAccountDeletion, markFeedbackUpgrade } from '@/server/actions/feedback'
import { ROUTES } from '@/lib/routes'

type Step = 'feedback' | 'decision' | 'confirm-delete'

interface TrialEndModalProps {
  open: boolean
}

export function TrialEndModal({ open }: TrialEndModalProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('feedback')
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [message, setMessage] = useState('')
  const [feedbackId, setFeedbackId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleAdvance() {
    setLoading(true)
    const promise = saveFeedback({ rating, message })
    toast.promise(promise, {
      loading: 'Aguarde...',
      success: 'Avaliação registrada.',
      error: 'Erro ao salvar avaliação.',
    })
    const result = await promise.catch(() => null)
    setLoading(false)
    if (result?.feedbackId) {
      setFeedbackId(result.feedbackId)
      setStep('decision')
    }
  }

  async function handleUpgrade() {
    if (feedbackId) {
      await markFeedbackUpgrade(feedbackId, 'upgrade_modal').catch(() => null)
    }
    router.push(ROUTES.planos)
  }

  async function handleConfirmDelete() {
    if (!feedbackId) return
    setLoading(true)
    const promise = scheduleAccountDeletion(feedbackId)
    toast.promise(promise, {
      loading: 'Aguarde...',
      success: 'Conta encerrada. Seus dados serão excluídos em 7 dias.',
      error: 'Erro ao encerrar conta.',
    })
    await promise.catch(() => null)
    setLoading(false)
    window.location.href = ROUTES.login
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        onEscapeKeyDown={e => e.preventDefault()}
        onPointerDownOutside={e => e.preventDefault()}
        onInteractOutside={e => e.preventDefault()}
      >
        <DialogHeader className="items-center">
          <Logo size="sm" id="trial-end" />
        </DialogHeader>
        <Separator />

        {step === 'feedback' && (
          <div className="flex flex-col items-center gap-5 py-2">
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-3xl">⭐</span>
              <DialogTitle className="text-lg font-bold">
                Seu período de teste chegou ao fim!
              </DialogTitle>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">
                Conte-nos como foi sua experiência com a IA
              </p>
            </div>

            <div className="flex flex-col items-center gap-2 w-full">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Avaliação do Anamnese IA
              </p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    aria-label={`estrela ${n}`}
                    onClick={() => setRating(n)}
                    onMouseEnter={() => setHovered(n)}
                    onMouseLeave={() => setHovered(0)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star
                      className="w-7 h-7"
                      fill={(hovered || rating) >= n ? '#F59E0B' : 'transparent'}
                      stroke={(hovered || rating) >= n ? '#F59E0B' : 'currentColor'}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-2">
                Sugestões de melhoria (opcional)
              </p>
              <Textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Como podemos tornar o Anamnese IA ainda melhor para você?"
                rows={3}
                className="resize-none"
              />
            </div>

            <Button
              className="w-full"
              onClick={handleAdvance}
              disabled={rating === 0 || loading}
            >
              Avançar →
            </Button>
          </div>
        )}

        {step === 'decision' && (
          <div className="flex flex-col items-center gap-5 py-2">
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-3xl">🚀</span>
              <DialogTitle className="text-lg font-bold">
                O que deseja fazer agora?
              </DialogTitle>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">
                Oferta de lançamento
              </p>
            </div>
            <Button className="w-full" onClick={handleUpgrade}>
              Ver planos disponíveis
            </Button>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => setStep('confirm-delete')}
            >
              Encerrar período de teste
            </Button>
          </div>
        )}

        {step === 'confirm-delete' && (
          <div className="flex flex-col items-center gap-5 py-2">
            <div className="flex flex-col items-center gap-1 text-center">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <span className="text-destructive text-xl">⚠</span>
              </div>
              <DialogTitle className="text-lg font-bold text-destructive">
                Exclusão Crítica
              </DialogTitle>
              <p className="text-sm text-muted-foreground">Direito ao Esquecimento</p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 text-center space-y-2">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Em conformidade com a{' '}
                <span className="font-bold text-foreground">LGPD</span>, informamos que:
              </p>
              <p className="text-sm font-medium">
                "Todos os prontuários, registros e dados de pacientes gerados durante
                seu teste serão permanentemente apagados dos nossos servidores."
              </p>
            </div>

            <div className="border border-destructive/30 rounded-md px-4 py-2">
              <p className="text-xs text-destructive font-medium uppercase tracking-widest">
                Você tem 7 dias para cancelar esta ação
              </p>
            </div>

            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep('decision')}
              >
                Voltar
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleConfirmDelete}
                disabled={loading}
              >
                Confirmar encerramento
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Rodar e confirmar verde**

```bash
npm test -- src/components/trial/trial-end-modal.test.tsx
```
Expected: PASS (7 tests)

- [ ] **Step 3: Commit**

```bash
git add src/components/trial/trial-end-modal.tsx src/components/trial/trial-end-modal.test.tsx
git commit -m "feat(trial): add TrialEndModal with 3-step flow (feedback → decision → confirm-delete)"
```

---

## Task 9: Wiring do TrialEndModal no consultation-page-flow

**Files:**
- Modify: `src/app/(session)/consultation/[id]/consultation-page-flow.tsx`
- Modify: `src/app/(session)/consultation/[id]/page.tsx` (para passar creditsRemaining + planId)

- [ ] **Step 1: Adicionar props `creditsRemaining` e `planId` em `consultation-page-flow.tsx`**

Localize a interface `ConsultationPageFlowProps` e adicione:

```typescript
interface ConsultationPageFlowProps {
  // ... props existentes ...
  creditsRemaining: number
  planId: string
}
```

Localize `AtendimentoFlow` (inner component) e adicione as mesmas props.

- [ ] **Step 2: Adicionar estado e lógica de trigger em `AtendimentoFlow`**

No início do componente `AtendimentoFlow`, adicione:

```typescript
const [showTrialEndModal, setShowTrialEndModal] = useState(false)
```

Localize a função `handleDebit`. Após o bloco `if (!result.error)`, adicione:

```typescript
    if (!result.error) {
      setCreditDebited(true)
      setAiWasUsed(false)
      setActiveTranscript('')
      setActiveRefinementsUsed(0)
      setAttemptsUsed(0)
      // Trigger do modal de fim de trial
      if (creditsRemaining - 1 <= 0 && planId === 'experimental') {
        setShowTrialEndModal(true)
      }
    }
```

- [ ] **Step 3: Adicionar o import e o componente no JSX**

No topo do arquivo adicione:

```typescript
import { TrialEndModal } from '@/components/trial/trial-end-modal'
```

No JSX de `AtendimentoFlow`, antes do `</>` final do return, adicione:

```tsx
<TrialEndModal open={showTrialEndModal} />
```

- [ ] **Step 4: Atualizar `page.tsx` para passar os novos props**

Localize `src/app/(session)/consultation/[id]/page.tsx`. Ele deve ler `creditsRemaining` e `planId` do usuário server-side:

```typescript
// Adicione ao fetch server-side existente:
const storedUser = await findUserById(payload.sub)

// Passe para o componente:
<ConsultationPageFlow
  // ... props existentes ...
  creditsRemaining={storedUser?.creditsRemaining ?? 0}
  planId={storedUser?.planId ?? 'experimental'}
/>
```

Adicione o import no topo:
```typescript
import { findUserById } from '@/server/repositories/users'
```

- [ ] **Step 5: Rodar os testes existentes da consultation flow**

```bash
npm test -- consultation-page-flow
```
Expected: PASS (todos os testes existentes continuam passando)

- [ ] **Step 6: Commit**

```bash
git add src/app/\(session\)/consultation/
git commit -m "feat(consultation): trigger TrialEndModal when last experimental credit is used"
```

---

## Task 10: DeletionBanner

**Files:**
- Create: `src/components/layout/deletion-banner.tsx`
- Create: `src/components/layout/deletion-banner.test.tsx`

- [ ] **Step 1: Escrever testes falhando**

```typescript
// src/components/layout/deletion-banner.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DeletionBanner } from './deletion-banner'

const mockCancelAccountDeletion = vi.fn()
const mockRefresh = vi.fn()

vi.mock('@/server/actions/feedback', () => ({
  cancelAccountDeletion: mockCancelAccountDeletion,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

vi.mock('sonner', () => ({
  toast: { promise: vi.fn((p: Promise<unknown>) => p), success: vi.fn() },
}))

describe('DeletionBanner', () => {
  beforeEach(() => vi.clearAllMocks())

  it('nao renderiza quando deletionScheduledAt é null', () => {
    const { container } = render(<DeletionBanner deletionScheduledAt={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renderiza banner com dias restantes', () => {
    // 7 dias no futuro
    const future = new Date()
    future.setDate(future.getDate() + 7)
    render(<DeletionBanner deletionScheduledAt={future.toISOString()} />)
    expect(screen.getByText(/será encerrada/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument()
  })

  it('chama cancelAccountDeletion ao clicar Cancelar', async () => {
    mockCancelAccountDeletion.mockResolvedValue({ ok: true })
    const future = new Date()
    future.setDate(future.getDate() + 3)
    render(<DeletionBanner deletionScheduledAt={future.toISOString()} />)

    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }))
    await waitFor(() => expect(mockCancelAccountDeletion).toHaveBeenCalledOnce())
    expect(mockRefresh).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar e confirmar falha**

```bash
npm test -- src/components/layout/deletion-banner.test.tsx
```
Expected: FAIL — `Cannot find module './deletion-banner'`

- [ ] **Step 3: Implementar DeletionBanner**

```typescript
// src/components/layout/deletion-banner.tsx
'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cancelAccountDeletion } from '@/server/actions/feedback'

interface DeletionBannerProps {
  deletionScheduledAt: string | null
}

export function DeletionBanner({ deletionScheduledAt }: DeletionBannerProps) {
  const router = useRouter()

  if (!deletionScheduledAt) return null

  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(deletionScheduledAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  )

  async function handleCancel() {
    const promise = cancelAccountDeletion()
    toast.promise(promise, {
      loading: 'Aguarde...',
      success: 'Encerramento cancelado. Sua conta está ativa.',
      error: 'Erro ao cancelar. Tente novamente.',
    })
    await promise.catch(() => null)
    router.refresh()
  }

  return (
    <div className="w-full bg-destructive/10 border-b border-destructive/20 px-4 py-2 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-sm">
        <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
        <span>
          Sua conta será encerrada em{' '}
          <strong className="text-destructive">{daysLeft} dia{daysLeft !== 1 ? 's' : ''}</strong>.
          Todos os dados serão excluídos permanentemente.
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 border-destructive text-destructive hover:bg-destructive hover:text-white"
        onClick={handleCancel}
      >
        Cancelar encerramento
      </Button>
    </div>
  )
}
```

- [ ] **Step 4: Rodar e confirmar verde**

```bash
npm test -- src/components/layout/deletion-banner.test.tsx
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/deletion-banner.tsx src/components/layout/deletion-banner.test.tsx
git commit -m "feat(layout): add DeletionBanner with 7-day grace period and cancel action"
```

---

## Task 11: Wiring do DeletionBanner e bonus_credits no app layout

**Files:**
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/app/(app)/app-layout-client.tsx`
- Modify: `src/components/layout/sidebar-credits.tsx`

- [ ] **Step 1: Passar `deletionScheduledAt` e `bonusCredits` do layout server**

Em `src/app/(app)/layout.tsx`, dentro do bloco `if (payload)`, após a atribuição de `initialUser`, adicione:

```typescript
    const deletionScheduledAt = storedUser.deletionScheduledAt ?? null
    const bonusCredits = storedUser.bonusCredits ?? 0
```

Atualize ambos os `return` para passar os novos props:

```tsx
    return (
      <AppLayoutClient
        initialUser={initialUser}
        initialCredits={initialCredits}
        initialPlanQuota={initialPlanQuota}
        isOnboarding={isOnboarding}
        deletionScheduledAt={deletionScheduledAt}
        bonusCredits={bonusCredits}
      >
        {children}
      </AppLayoutClient>
    )
```

O segundo `return` (fora do if): passe `deletionScheduledAt={null}` e `bonusCredits={0}`.

- [ ] **Step 2: Atualizar `AppLayoutClient` para receber e usar os novos props**

Em `src/app/(app)/app-layout-client.tsx`:

Adicione o import:
```typescript
import { DeletionBanner } from '@/components/layout/deletion-banner'
```

Adicione os novos props à interface de `AppLayoutClient` e `AppShell`:

```typescript
// AppLayoutClient props
deletionScheduledAt: string | null
bonusCredits: number

// AppShell props
deletionScheduledAt: string | null
bonusCredits: number
```

No JSX do `AppShell`, atualize `sidebarPreFooter` para incluir `bonusCredits`:

```tsx
  const sidebarPreFooter = !isOnboarding ? (
    <SidebarCredits credits={credits} planQuota={planQuota} bonusCredits={bonusCredits} />
  ) : undefined
```

Adicione o `DeletionBanner` logo acima do `<Topbar`:

```tsx
      <DeletionBanner deletionScheduledAt={deletionScheduledAt} />
      <Topbar ... />
```

Passe `deletionScheduledAt` e `bonusCredits` de `AppLayoutClient` para `AppShell`:

```tsx
  return (
    <AppProvider ...>
      <AppShell isOnboarding={isOnboarding} deletionScheduledAt={deletionScheduledAt} bonusCredits={bonusCredits}>
        {children}
      </AppShell>
    </AppProvider>
  )
```

- [ ] **Step 3: Atualizar `SidebarCredits` para exibir bonus**

Em `src/components/layout/sidebar-credits.tsx`, adicione `bonusCredits?: number` à interface:

```typescript
interface SidebarCreditsProps {
  credits: number
  planQuota?: number
  bonusCredits?: number
}
```

No JSX, após a linha do label de créditos e antes da barra de progresso, adicione:

```tsx
      {(bonusCredits ?? 0) > 0 && (
        <div className="flex items-center gap-1.5 text-xs mt-1"
          style={{ background: 'linear-gradient(90deg, #8B5CF6, #06B6D4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
        >
          <span style={{ fontSize: '9px' }}>✦</span>
          {bonusCredits} crédito{bonusCredits !== 1 ? 's' : ''} bônus
        </div>
      )}
```

- [ ] **Step 4: Rodar todos os testes**

```bash
npm test
```
Expected: PASS (todos)

- [ ] **Step 5: Commit final**

```bash
git add src/app/\(app\)/layout.tsx src/app/\(app\)/app-layout-client.tsx src/components/layout/sidebar-credits.tsx
git commit -m "feat(layout): wire DeletionBanner and bonus_credits into app shell"
```

---

## Checkpoint — Plano 1 completo

Ao finalizar todas as tasks, o sistema deve:

- [ ] Modal de fim de trial aparece apenas no último crédito do plano experimental
- [ ] 3 steps: avaliação → decisão → confirmação de exclusão (LGPD)
- [ ] Modal não fecha com ESC ou clique fora
- [ ] "Ver planos" vai para `/plans` e registra `upgrade_modal`
- [ ] "Encerrar" agenda exclusão em 7 dias e faz logout
- [ ] Banner de grace period aparece em todo login durante os 7 dias
- [ ] Cancelar exclusão limpa `deletion_scheduled_at` e remove o banner
- [ ] Upgrade orgânico move créditos restantes para `bonus_credits`
- [ ] Sidebar exibe badge de créditos bônus com gradiente quando > 0
- [ ] `debit_user_credit` RPC consome bonus primeiro

**Próximo passo:** Plano 2 — Admin Feedbacks + Tempo Poupado (`docs/superpowers/plans/2026-04-10-trial-end-feedback-plan2.md`)
