# Plan Interest Capture — "Quero ser avisado"

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capturar o interesse de visitantes nos planos Profissional e Gestão & Clínicas via formulário (nome + email) na landing page, persistir no Supabase e exibir os registros no console do master com agrupamento por plano.

**Architecture:**
- Tabela `plan_interest (id, name, email, plan, created_at)` com unique `(email, plan)` → upsert evita duplicatas sem erro
- RLS: INSERT liberado para `anon` (visitante não autenticado), SELECT restrito a `service_role`
- Server Action pública `savePlanInterestAction` — sem `getServerUser()`, valida via Zod e chama repositório
- Zod schema `planInterestSchema` centralizado em `src/lib/schemas.ts`
- Dialog na landing via shadcn `Dialog` direto (marketing route — fora do contexto app/console)
- Console `/console/interesses` — Server Component carrega dados, passa para Client table com filtro por plano

**Segurança:**
- Mass assignment: apenas campos do schema Zod chegam ao Supabase (nunca spread direto)
- XSS: `name.trim().max(100)` e `email.email()` no schema
- Deduplicação: unique constraint `(email, plan)` + upsert — previne spam sem rate limiting adicional
- `plan` validado como enum Zod — nunca valor livre do cliente chega ao banco

---

## File Map

| Ação | Arquivo |
|---|---|
| Criar | `supabase/migrations/20260508_plan_interest.sql` |
| Criar | `src/server/repositories/plan-interest.ts` |
| Criar | `src/server/actions/plan-interest.ts` |
| Modificar | `src/lib/schemas.ts` — adicionar `planInterestSchema` |
| Modificar | `src/lib/routes.ts` — adicionar `consoleInteresses` |
| Modificar | `src/components/landing/plans-section.tsx` — `NotifyButton` abre dialog |
| Criar | `src/components/landing/plan-interest-dialog.tsx` |
| Criar | `src/app/(admin)/console/interesses/page.tsx` |
| Criar | `src/app/(admin)/console/interesses/interesses-client.tsx` |
| Modificar | `src/app/(admin)/console/admin-layout-client.tsx` — adicionar nav item |

---

## Task 1: Migration SQL

**Files:**
- Create: `supabase/migrations/20260508_plan_interest.sql`

- [ ] **Step 1: Criar tabela e RLS**

```sql
create table if not exists plan_interest (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  plan       text not null check (plan in ('profissional', 'gestao-clinicas')),
  created_at timestamptz not null default now(),
  constraint plan_interest_email_plan_unique unique (email, plan)
);

alter table plan_interest enable row level security;

-- Qualquer visitante pode registrar interesse
create policy "anon can insert plan_interest"
  on plan_interest for insert
  to anon
  with check (true);

-- Somente service_role lê (console master)
-- SELECT não liberado para authenticated nem anon
```

---

## Task 2: Schema Zod

**Files:**
- Modify: `src/lib/schemas.ts`

- [ ] **Step 2: Adicionar `planInterestSchema`**

```ts
export const PLAN_INTEREST_PLANS = ['profissional', 'gestao-clinicas'] as const
export type PlanInterestPlan = typeof PLAN_INTEREST_PLANS[number]

export const planInterestSchema = z.object({
  name:  z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100).trim(),
  email: z.string().min(1, 'Email é obrigatório').email({ message: 'Email inválido' }),
  plan:  z.enum(PLAN_INTEREST_PLANS),
})

export type PlanInterestFormData = z.infer<typeof planInterestSchema>
```

---

## Task 3: Repository

**Files:**
- Create: `src/server/repositories/plan-interest.ts`

- [ ] **Step 3: `PlanInterestRepository` com `save` (upsert) e `list`**

```ts
// save: upsert por (email, plan) — atualiza created_at se já existe
// list: retorna todos ordenados por created_at desc
// Nunca expõe método de delete (dados de produto, não remover)
```

---

## Task 4: Server Action

**Files:**
- Create: `src/server/actions/plan-interest.ts`

- [ ] **Step 4: `savePlanInterestAction` — pública, sem auth**

```ts
'use server'
// Sem getServerUser() — visitante não autenticado
// Valida com planInterestSchema antes de qualquer acesso ao banco
// Retorna { error?: string } — sem throw, o client trata
```

---

## Task 5: Routes

**Files:**
- Modify: `src/lib/routes.ts`

- [ ] **Step 5: Adicionar `consoleInteresses`**

```ts
consoleInteresses: '/console/interesses',
```

---

## Task 6: PlanInterestDialog (landing)

**Files:**
- Create: `src/components/landing/plan-interest-dialog.tsx`
- Modify: `src/components/landing/plans-section.tsx`

- [ ] **Step 6: Dialog com RHF + toast.promise**

- `'use client'`
- shadcn `Dialog` / `DialogContent` direto (marketing route, fora de app/console)
- RHF: `mode: 'onTouched'`, `zodResolver(planInterestSchema)`
- Campo oculto `plan` pré-preenchido com o plano do card
- `toast.promise(savePlanInterestAction(data).catch(() => {}), { loading: 'Aguarde...', success: '...', error: '...' })`
- Botão submit: `disabled={isSubmitting}`
- Fechar dialog no `onSuccess` do toast
- `NotifyButton` em `plans-section.tsx` passa `plan` para o dialog e controla `open` state

---

## Task 7: Console page — Interesses

**Files:**
- Create: `src/app/(admin)/console/interesses/page.tsx`
- Create: `src/app/(admin)/console/interesses/interesses-client.tsx`

- [ ] **Step 7: Página server + client com tabela e filtro por plano**

- `page.tsx`: Server Component, chama `PlanInterestRepository.list()`, passa para client
- `interesses-client.tsx`: tabela com colunas `nome | email | plano | data`, filtro por plano (`all | profissional | gestao-clinicas`), contador por plano no header
- Padrão visual idêntico ao `requests-client.tsx`

---

## Task 8: Sidebar

**Files:**
- Modify: `src/app/(admin)/console/admin-layout-client.tsx`

- [ ] **Step 8: Adicionar "Interesses" no nav**

```ts
import { Bell } from 'lucide-react' // já importado ou adicionar
{ href: ROUTES.consoleInteresses, label: 'Interesses', icon: Bell }
// Posicionar após 'Feedbacks'
```
