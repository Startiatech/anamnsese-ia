# Design: Trial End Feedback, Grace Period & Admin Feedbacks

**Data:** 2026-04-10
**Status:** Aprovado
**Escopo:** Plano experimental — fluxo de fim de créditos, feedback do usuário, decisão de conta, bonus credits, card de tempo poupado e página admin de feedbacks.

---

## 1. Contexto

O plano `experimental` concede 5 créditos ao usuário. Ao esgotar o último crédito em uma consulta, o sistema deve:

1. Coletar feedback do usuário sobre a experiência
2. Apresentar a decisão: fazer upgrade ou encerrar conta
3. Se encerrar: aplicar grace period de 7 dias (LGPD) antes da exclusão definitiva
4. Se fazer upgrade orgânico antes de esgotar créditos: herdar créditos restantes como bônus

Adicionalmente:
- Dashboard do profissional ganha card de **Tempo Poupado**
- Admin-master ganha página **/console/feedbacks** com métricas, depoimentos e análise de sentimento via Groq

---

## 2. Banco de Dados

### 2.1 Nova tabela `feedbacks`

```sql
CREATE TABLE feedbacks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES users(id) ON DELETE CASCADE,
  rating          smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  message         text,
  plan_id         text NOT NULL DEFAULT 'experimental',
  action_taken    text NOT NULL DEFAULT 'pending',
    -- valores: 'pending' | 'upgrade_modal' | 'upgrade_organic' | 'declined'
  sentiment_score numeric,
  sentiment_label text,
    -- valores: 'positive' | 'neutral' | 'negative'
  analyzed_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

### 2.2 Alterações em `users`

```sql
ALTER TABLE users
  ADD COLUMN deletion_scheduled_at timestamptz,
  ADD COLUMN bonus_credits smallint NOT NULL DEFAULT 0;
```

### 2.3 Atualização do RPC `debit_user_credit`

Ordem de débito: `bonus_credits` primeiro, depois `credits_remaining`.

```sql
CREATE OR REPLACE FUNCTION debit_user_credit(p_user_id uuid)
RETURNS void AS $$
BEGIN
  IF (SELECT bonus_credits FROM users WHERE id = p_user_id) > 0 THEN
    UPDATE users SET bonus_credits = bonus_credits - 1 WHERE id = p_user_id;
  ELSE
    UPDATE users SET credits_remaining = GREATEST(credits_remaining - 1, 0) WHERE id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql;
```

### 2.4 pg_cron — exclusão após grace period

Job diário às 02:00 UTC. O CASCADE deleta patients, consultations e feedbacks.

```sql
SELECT cron.schedule(
  'delete-expired-accounts',
  '0 2 * * *',
  $$DELETE FROM users WHERE deletion_scheduled_at IS NOT NULL AND deletion_scheduled_at <= now()$$
);
```

---

## 3. Modal de Fim de Trial (`TrialEndModal`)

### 3.1 Trigger

Em `consultation-page-flow.tsx`, após navegação para `step-anamnesis` e debit do crédito:

```
if (creditsRemaining === 0 && planId === 'experimental' && !hasFeedback) {
  // monta TrialEndModal com open={true}
}
```

`hasFeedback` é verificado via Server Action ao montar o componente (evita re-exibição se usuário já deu feedback).

### 3.2 Estrutura do componente

`src/components/trial/trial-end-modal.tsx` — client component.

Modal obrigatório:
- `onOpenChange` bloqueado (sem fechar por ESC ou clique fora)
- Padrão visual do projeto: **logo → divisória → conteúdo**
- 3 steps internos controlados por estado local

### 3.3 Step 1 — Avaliação (`step: 'feedback'`)

```
[logo]
────────────────────────
[ícone ⭐]
"Seu período de teste chegou ao fim!"
CONTE-NOS COMO FOI SUA EXPERIÊNCIA COM A IA

[estrelas 1-5 clicáveis]
AVALIAÇÃO DO ANAMNESE IA

[textarea]
SUGESTÕES DE MELHORIA (OPCIONAL)
placeholder: "Como podemos tornar o Anamnese IA ainda melhor para você?"

[btn primário "Avançar →"]  ← desabilitado até selecionar ao menos 1 estrela
```

Ao avançar: chama Server Action `saveFeedback({ rating, message, planId: 'experimental', action_taken: 'pending' })` → retorna `feedbackId` para os próximos steps.

### 3.4 Step 2 — Decisão (`step: 'decision'`)

```
[logo]
────────────────────────
[ícone 🚀]
"O que deseja fazer agora?"
OFERTA DE LANÇAMENTO

[btn primário]  "Ver planos disponíveis"
[btn ghost]     "Encerrar período de teste"
```

- **"Ver planos disponíveis"**: atualiza `action_taken = 'upgrade_modal'` via Server Action → `router.push(ROUTES.plans)`
- **"Encerrar período de teste"**: avança para step 3

### 3.5 Step 3 — Confirmação de exclusão (`step: 'confirm-delete'`)

```
[logo]
────────────────────────
[ícone ⚠ vermelho]
"Exclusão Crítica"
Direito ao Esquecimento

EM CONFORMIDADE COM A LGPD, INFORMAMOS QUE:

"Todos os prontuários, registros e dados de pacientes
gerados durante seu teste serão permanentemente
apagados dos nossos servidores."

[badge outline] VOCÊ TEM 7 DIAS PARA CANCELAR ESTA AÇÃO

[btn outline "Voltar"]    [btn destructive "Confirmar encerramento"]
```

- **"Voltar"**: retorna ao step 2
- **"Confirmar encerramento"**: chama Server Action `scheduleAccountDeletion(feedbackId)` que:
  1. Seta `users.deletion_scheduled_at = now() + interval '7 days'`
  2. Atualiza `feedbacks.action_taken = 'declined'`
  3. Retorna `{ ok: true }`
  → Após confirmação: `window.location.href = ROUTES.login`

---

## 4. Grace Period — Banner no Layout Autenticado

### 4.1 Detecção

Em `src/app/(app)/layout.tsx` (Server Component), `getServerUser()` retorna `deletion_scheduled_at`. Se preenchido, passa para `AppLayoutClient`.

### 4.2 Banner

`src/components/layout/deletion-banner.tsx` — client component. Renderizado no topo do layout autenticado:

```
[⚠] Sua conta será encerrada em X dias. Todos os dados serão excluídos permanentemente.
    [Cancelar encerramento]
```

Clicar "Cancelar encerramento": Server Action `cancelAccountDeletion()` seta `deletion_scheduled_at = null` → `router.refresh()`.

Após cancelar: usuário permanece com `credits_remaining = 0`, conta ativa, sem créditos. Sidebar exibe destaque de upgrade.

---

## 5. Bonus Credits

### 5.1 Fluxo de upgrade orgânico

Na Server Action de ativação de plano (`src/server/actions/plans.ts`), antes de aplicar o novo plano:

```ts
if (user.planId === 'experimental' && user.creditsRemaining > 0) {
  await supabase.from('users').update({
    bonus_credits: user.creditsRemaining
  }).eq('id', userId)
}
// registra feedback com action_taken = 'upgrade_organic'
await saveFeedback({ userId, action_taken: 'upgrade_organic', ... })
```

### 5.2 UI — Sidebar Credits

`src/components/layout/sidebar-credits.tsx` exibe:

```
● 3 créditos bônus    ← badge gradiente (#8B5CF6 → #06B6D4)
  40 créditos do plano
```

Se `bonus_credits = 0`, não exibe a linha de bônus.

---

## 6. Card Tempo Poupado (Dashboard Profissional)

### 6.1 Cálculo

- Baseline: **45 min poupados por consulta** (conservador: anamnese manual ~50-60min, com IA ~10-15min)
- Sem coluna nova no banco — calculado via query COUNT × 45

### 6.2 Query (server-side em `dashboard/page.tsx`)

```ts
// Hoje, semana, mês — 3 queries paralelas
const [today, week, month] = await Promise.all([
  ConsultationRepository.countByPeriod(userId, 'today'),
  ConsultationRepository.countByPeriod(userId, 'week'),
  ConsultationRepository.countByPeriod(userId, 'month'),
])
const MINUTES_PER_CONSULTATION = 45
```

### 6.3 UI

Novo card em `src/components/dashboard/metrics-row.tsx`:

```
TEMPO POUPADO
[Hoje] [Semana] [Mês]   ← tabs/toggle

   2h 15min
   3 consultas × 45min
```

Formato: se < 60min → "45min"; se >= 60min → "Xh Ymin".

---

## 7. Página Admin `/console/feedbacks`

**Rota:** `src/app/(admin)/console/feedbacks/page.tsx`

### 7.1 Métricas (4 cards)

| Card | Cálculo |
|---|---|
| Satisfação | AVG(rating) de todos os feedbacks |
| Conversão | COUNT onde action_taken IN ('upgrade_modal','upgrade_organic') / COUNT total × 100 |
| Upgrades | COUNT onde action_taken IN ('upgrade_modal','upgrade_organic') |
| Churn | COUNT onde action_taken = 'declined' |

### 7.2 Depoimentos Recentes

Lista paginada (20/página), ordenada por `created_at DESC`:

```
⭐⭐⭐⭐⭐  [UPGRADE]    10/04/2026    [Email]  [WhatsApp]
"Como podemos tornar..."
👤 profissional12teste   ✉ profissional12teste@gmail.com
```

Badges por `action_taken`:
- `upgrade_modal` / `upgrade_organic` → **UPGRADE** (verde)
- `declined` → **CANCELADO** (vermelho)
- `pending` → **PENDENTE** (amarelo)

### 7.3 Análise de Sentimento Groq

**Botão "Analisar Feedbacks":**
- Busca feedbacks onde `sentiment_score IS NULL`
- Envia batch para Groq `llama-3.3-70b` com prompt estruturado
- Salva por feedback: `sentiment_score`, `sentiment_label`, `analyzed_at`
- Exibe resultado consolidado: média global, top 3 elogios, top 3 sugestões/reclamações

**Botão "Recalcular IA":**
- Re-processa todos os feedbacks (ignora `analyzed_at`)
- Útil quando o prompt de análise for atualizado

**API route:** `POST /api/admin/feedbacks/analyze`

---

## 8. Novos arquivos

| Arquivo | Tipo |
|---|---|
| `src/components/trial/trial-end-modal.tsx` | Client Component |
| `src/components/layout/deletion-banner.tsx` | Client Component |
| `src/server/repositories/feedbacks.ts` | Server repository |
| `src/server/actions/feedback.ts` | Server Actions |
| `src/app/(admin)/console/feedbacks/page.tsx` | Server Component |
| `src/app/(admin)/console/feedbacks/feedbacks-client.tsx` | Client Component |
| `src/app/api/admin/feedbacks/analyze/route.ts` | API Route |
| `supabase/migrations/YYYYMMDD_feedback_trial.sql` | Migration SQL |

## 9. Arquivos modificados

| Arquivo | Alteração |
|---|---|
| `src/app/(session)/consultation/[id]/consultation-page-flow.tsx` | Montar `TrialEndModal` ao detectar último crédito |
| `src/app/(app)/layout.tsx` | Passar `deletionScheduledAt` para layout client |
| `src/app/(app)/app-layout-client.tsx` | Renderizar `DeletionBanner` |
| `src/components/layout/sidebar-credits.tsx` | Exibir `bonus_credits` |
| `src/components/dashboard/metrics-row.tsx` | Adicionar card Tempo Poupado |
| `src/app/(app)/dashboard/page.tsx` | Queries de contagem por período |
| `src/server/repositories/users.ts` | Campos `deletion_scheduled_at`, `bonus_credits` |
| `src/server/actions/plans.ts` | Herdar `bonus_credits` no upgrade |
| `src/lib/routes.ts` | Adicionar `ROUTES.consoleFeedbacks` |

---

## 10. Testes

- TDD obrigatório: RED → GREEN → REFACTOR
- Cada Server Action tem teste unitário com mock Supabase via `vi.hoisted`
- `TrialEndModal`: testes RTL para os 3 steps, verificando transições e estados desabilitados
- `DeletionBanner`: testa render condicional e cancelamento
- `debit_user_credit` RPC: testar ordem bonus → plan credits
- Admin feedbacks page: testa cálculo das métricas
