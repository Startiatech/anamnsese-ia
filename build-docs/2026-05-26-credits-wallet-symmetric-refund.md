# Build 2026-05-26 — Carteira de créditos simétrica + remoção de herança trial

Documento vivo. Atualizar a cada alteração desta sessão.

## Contexto

Bug crítico em produção: créditos eram debitados prioritariamente da carteira `bonus_credits`, mas o estorno (refund) sempre voltava para `credits_remaining`, gerando assimetria entre as duas carteiras. Em paralelo, três outros problemas estruturais coexistiam:

1. `getCredits` retornava só `credits_remaining`, ignorando `bonus_credits` na soma → usuário com bonus podia ser bloqueado de iniciar consulta mesmo com saldo total positivo.
2. UI da topbar/sidebar não refletia débito/estorno em tempo real porque `AppContext` usava `useState(initialCredits)` sem sincronizar prop changes do layout RSC.
3. Após upgrade do plano experimental, o saldo restante era "migrado" para `bonus_credits` (regra antiga de retenção). Decisão de produto: remover essa migração e adotar reset de quota no padrão SaaS de mercado.

## Modelo de carteiras alinhado

| Carteira | Fonte | Comportamento |
|---|---|---|
| `credits_remaining` | Saldo do plano (experimental, pago, qualquer). Reset para `plan.quota` em toda troca de plano. | Padrão de mercado SaaS — substituir, não somar. |
| `bonus_credits` | Cortesia/urgência — alimentada **exclusivamente** pela injeção do master. Sem ciclo. | Drenada com prioridade no débito. |

**Regras:**
1. Débito drena `bonus_credits` primeiro, depois `credits_remaining`.
2. Estorno volta para a **mesma carteira** de onde saiu (via `debit_source` persistido na consulta).
3. UI mostra as duas linhas separadas na sidebar (`SidebarCredits` já estava pronto).
4. Validações de saldo total (`getCredits`) somam `bonus + paid`.

## Alterações

### 1. Schema (migration `20260526_credit_wallet_symmetric_refund.sql`)

- `ALTER TABLE consultations ADD COLUMN IF NOT EXISTS debit_source text CHECK (debit_source IN ('bonus', 'paid'))` — registra de qual carteira saiu o débito.
- RPC `debit_user_credit(p_user_id uuid)` passa a retornar `text` ('bonus' | 'paid') — comportamento de débito inalterado, só agora reporta a origem.
- RPC `refund_user_credit(p_user_id uuid, p_source text)` — assinatura nova; devolve na carteira indicada.
- Nova RPC `add_user_bonus_credits(p_user_id uuid, p_amount integer)` — usada exclusivamente pela injeção do master.
- Migration idempotente (`IF NOT EXISTS` no ALTER TABLE, `DROP FUNCTION IF EXISTS` nas funções com assinatura alterada).
- Aplicada em **prod** e **teste**.

### 2. CreditRepository ([src/server/repositories/credits.ts](src/server/repositories/credits.ts))

- `debitCreditReturningSource(userId)` → `Promise<'bonus' | 'paid' | null>` — wraps a RPC nova.
- `refundCredit(userId, source)` — estorno simétrico.
- `addBonusCredits(userId, amount)` — wrapper da RPC de injeção.
- `getCreditsBreakdown(userId)` → `{ bonus, paid, total }` — leitura granular.
- `getCredits(userId)` atualizado para retornar `bonus + paid` (soma das duas carteiras).
- `debitCredit` (legado, retorna void) mantido — outros callers podem usar.
- TDD: 15 testes em [src/lib/credits.test.ts](src/lib/credits.test.ts).

### 3. Server Action — débito de consulta ([src/server/actions/consultation.ts](src/server/actions/consultation.ts))

- `debitConsultationCredit` agora chama `CreditRepository.getCredits` (sum) para validar saldo total.
- Chama `CreditRepository.debitCreditReturningSource` e persiste `debit_source` no row da consulta via upsert.
- Retorna erro `'Falha ao debitar crédito'` se RPC retornar null.

### 4. Server Action — abandono ([src/server/actions/consultation.ts](src/server/actions/consultation.ts))

- `abandonConsultation` lê `debit_source` da consulta existente **antes** do upsert.
- Quando `!aiWasUsed && source`, chama `CreditRepository.refundCredit(userId, source)` — estorno na carteira correta.
- TDD: 27 testes em [src/server/actions/consultation.test.ts](src/server/actions/consultation.test.ts).

### 5. Injeção do master vira bonus ([src/server/actions/credits.ts](src/server/actions/credits.ts))

- `injectCredits` passa a chamar `CreditRepository.addBonusCredits` em vez de `addCredits`.
- Cortesia/urgência fica na carteira `bonus_credits` separadamente do saldo do plano.
- TDD: 5 testes em [src/server/actions/credits.test.ts](src/server/actions/credits.test.ts).

### 6. Remoção da herança trial→bonus + reset de quota ([src/server/actions/plans.ts](src/server/actions/plans.ts), [src/server/repositories/plans.ts](src/server/repositories/plans.ts))

- Removido bloco em `selectPlanAction` que migrava `credits_remaining` restante do experimental para `bonus_credits` no upgrade.
- `PlanRepository.selectPlan` agora consulta `plans.quota` e reseta `credits_remaining` para a quota do plano selecionado na troca de plano.
- `plans-bonus.test.ts` (obsoleto) removido. Novos arquivos:
  - [src/server/actions/plans.test.ts](src/server/actions/plans.test.ts) — TDD da action.
  - [src/server/repositories/plans.test.ts](src/server/repositories/plans.test.ts) — TDD do reset de quota.

### 7. Sync de credits no AppProvider ([src/context/app-context.tsx](src/context/app-context.tsx))

- `useEffect([initialCredits])` espelha a prop no state interno.
- Necessário porque o `(app)/layout.tsx` (RSC) busca créditos fresh em cada navegação e passa nova prop, mas o `useState` ignorava mudanças após o mount.
- TDD: 3 testes em [src/context/app-context.test.tsx](src/context/app-context.test.tsx).

### 8. UI da consulta chama refreshCredits ([src/app/(session)/app/consultation/[id]/consultation-page-flow.tsx](src/app/(session)/app/consultation/[id]/consultation-page-flow.tsx))

- `handleDebit` aguarda `refreshCredits()` após débito bem-sucedido.
- `handleAbandonConfirmed` aguarda `refreshCredits()` dentro do `then` de `abandonConsultation`.
- TDD: 11 testes (2 novos cobrindo o refresh) em [consultation-page-flow.test.tsx](src/app/(session)/app/consultation/[id]/consultation-page-flow.test.tsx).

## Follow-ups entregues na mesma sessão

### Task 11 — Modal de notificação quando master injeta crédito

- **Schema:** expande `notifications.type` CHECK constraint para incluir `'credit_injected'` ([supabase/migrations/20260526b_notifications_type_credit_injected.sql](supabase/migrations/20260526b_notifications_type_credit_injected.sql)).
- **Action:** `injectCredits` ([src/server/actions/credits.ts](src/server/actions/credits.ts)) cria notification do tipo `credit_injected` após `addBonusCredits` (título com emoji 🎁 e quantidade).
- **Action nova:** `acknowledgeNotification` ([src/server/actions/notifications.ts](src/server/actions/notifications.ts)) — marca como lida.
- **Repo:** `findLatestUnreadByType` em [src/server/repositories/notifications.ts](src/server/repositories/notifications.ts).
- **UI:** [src/components/notifications/credit-injected-modal.tsx](src/components/notifications/credit-injected-modal.tsx) — `AppDialog` com botão "Entendi" que dispara acknowledgeNotification + refreshCredits.
- **Layout integration:** `(app)/layout.tsx` busca notification não-lida do tipo credit_injected e passa para AppLayoutClient, que renderiza o modal.
- **Bell:** [src/components/layout/notification-bell.tsx](src/components/layout/notification-bell.tsx) — ícone `Gift` cor emerald-400 para o novo tipo.
- **TDD:** 22 testes em 3 suites (credits, notifications, modal).

### Task 12a — Refresh automático ao voltar à aba

- **Componente:** [src/components/system/visibility-refresh.tsx](src/components/system/visibility-refresh.tsx) — listener `visibilitychange` que dispara `router.refresh()` quando aba volta a ficar visível.
- **Montado em:** AppLayoutClient.
- **Resultado:** após master injetar crédito, user não precisa de F5 — basta tirar e voltar à aba.
- **TDD:** 3 testes ([src/components/system/visibility-refresh.test.tsx](src/components/system/visibility-refresh.test.tsx)).

### Task 12b — Padronização de modais via AppAlertDialog

- **Componente novo:** [src/components/ui/app-alert-dialog.tsx](src/components/ui/app-alert-dialog.tsx) — irmão de `AppDialog` para confirmações via primitivas `AlertDialog*`. Mesmo header (logo + separador gradiente).
- **Refatorados (eliminação de ~150 linhas de duplicação de Logo+gradient inline):**
  - complete-confirm-dialog
  - delete-patient-dialog
  - delete-user-modal
  - credit-info-modal
  - consultation-page-flow (dialog de abandonar)
  - consultation-page-client (dialog de clínica obrigatória)
  - settings-client (dialog de clínica salva)
  - step-anamnesis (dialog de finalizar)
- **Mantidos custom (separator interno):** trial-end-modal (multi-step com 3 steps) e delete-account-modal (createPortal com identidade visual LGPD).

### Fix — `useApp` em route group sem AppProvider

- Tentei usar `useApp().refreshCredits()` em `consultation-page-flow` (route group `(session)`), mas esse grupo não tem AppProvider (layout fullscreen sem sidebar). Troquei por `router.refresh()` que re-roda os RSC e busca créditos fresh do server — mesmo efeito sem dependência do contexto.

### Cleanup

- `CreditRepository.addCredits` removido (sem callers após Task 5).
- Mock de `plans.test.ts` corrigido para cobrir o novo fetch de quota antes do update.

## Não entregue / out-of-scope desta sessão

- **Estorno retroativo** (Task 9 do plano): pulada por concordância do usuário — não havia consultas órfãs no banco para estornar.

## TDD — totais

| Arquivo | Testes |
|---|---|
| `credits.test.ts` (lib) | 15 |
| `consultation.test.ts` | 27 |
| `credits.test.ts` (actions) | 5 |
| `plans.test.ts` | 2 |
| `plans.test.ts` (repository) | 2 |
| `app-context.test.tsx` | 3 |
| `consultation-page-flow.test.tsx` | 11 |
| `credits.test.ts` (actions, com Task 11) | 8 |
| `notifications.test.ts` (actions) | 3 |
| `credit-injected-modal.test.tsx` | 2 |
| `visibility-refresh.test.tsx` | 3 |
| **Total específico desta entrega** | **80+** |

Suite completa (`pnpm run test:all`): **720+ testes** passando.

E2E (`pnpm playwright test e2e/specs/app/consultation.spec.ts`): 8/8 passando.

Build (`pnpm run build`): OK após limpar `.next` cache.

## Commits da entrega

1. `ab8b40c` — Migration SQL (criação)
2. `ef39d40` — Migration SQL (fix DROP FUNCTION)
3. `094bfe2` — Migration SQL (fix IF NOT EXISTS)
4. `4b5a2a6` — CreditRepository com métodos novos
5. `16284bd` — debitConsultationCredit persiste debit_source
6. `9e06a03` — abandonConsultation estorno simétrico
7. `3030cca` — injectCredits master alimenta bonus
8. `8796f53` — remove herança trial e reseta quota
9. `f7c8259` — AppProvider sync de credits
10. `182cc2c` — consultation-page-flow refreshCredits
11. `9c6ea3b` — build-doc + diagrama de arquitetura
12. `9428763` — modal de crédito bônus injetado (Task 11)
13. `faded4d` — check constraint notifications.type
14. `ed330a3` — ícone Gift para credit_injected
15. `932d081` — VisibilityRefresh (Task 12a)
16. `0350722` — AppAlertDialog padronização (Task 12b)
17. `75a6086` — fix useApp em (session) → router.refresh
18. `57c9a7d` — cleanup addCredits + fix mock plans.test
