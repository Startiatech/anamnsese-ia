# Correção: estorno de crédito via banco (F5) + Custo Groq zerado

**Data:** 2026-06-01
**Branch:** melhorando-ui-gravacao

## Contexto

Testando o fluxo de atendimento real surgiram dois bugs graves de contabilidade:

1. **Crédito consumido no meio do atendimento após F5** — mesmo sem ter usado transcrição de IA, o crédito não era devolvido.
2. **Custo Groq zerado** no console master (coluna por usuário), apesar de ter havido transcrições.

Causa conceitual comum: decisões dependiam de estado efêmero (React state / promise fire-and-forget) em vez do banco como fonte de verdade.

## Diagnóstico (causa raiz)

### Problema 1 — refund frágil (client-state)
A devolução era 100% client-side: dependia de dois `useState` (`creditDebited`, `aiWasUsed`) em `consultation-page-flow.tsx`. No F5/queda de rede/fechamento de aba esse estado morria. No reload, `creditDebited` voltava a `false` (a página não repassava esse fato), e `handleAbandonConfirmed` fazia early-return sem chamar `abandonConsultation` → crédito órfão, nunca devolvido.

### Problema 2 — RPCs de custo ausentes no dev
A coluna lê `api_usage_log` via RPC `get_all_users_groq_cost`. Diagnóstico no banco dev:
- `api_usage_log` existe e tinha 7 linhas (o registro grava).
- As 5 RPCs de custo **não existiam no dev** (existiam só no prod, criadas manualmente, nunca versionadas).

A RPC inexistente erra → `getAllUsersCostSummary` retorna `{}` → coluna mostra 0 pra todos. Não era o `void` fire-and-forget (esse era problema menor, secundário).

Comparação prod×dev de funções revelou também faltarem no dev: `increment_refinement_attempt` (quebra refinamento), `get_professionals_count`, `add_user_credits`.

## Alterações

### Banco (migrations versionadas, aplicadas em dev + prod)
- `supabase/migrations/20260601_groq_cost_functions.sql` — versiona as 5 RPCs de custo (definições capturadas do prod via `pg_get_functiondef`).
- `supabase/migrations/20260601b_align_dev_functions.sql` — versiona `increment_refinement_attempt`, `get_professionals_count`, `add_user_credits` (faltavam no dev). `debit_credit(p_user_id)` deixada de fora (órfã; código usa `debit_user_credit`).

### Código
- `src/server/actions/consultation.ts` — `abandonConsultation(patientId, currentStep)` (sem param `aiWasUsed`). Lê `debit_source` **e** `audio_attempts` do banco; devolve sse `debit_source != null && audio_attempts === 0`.
- `src/app/(session)/app/consultation/[id]/page.tsx` — SELECT inclui `debit_source`; expõe `creditAlreadyDebited` e `aiAlreadyUsed` derivados do banco.
- `src/app/(session)/app/consultation/[id]/consultation-page-flow.tsx` — hidrata `creditDebited`/`aiWasUsed` das props (banco); callsite do abandono ajustado para 2 args.
- `src/app/api/transcribe/route.ts` — `void UsageRepository.logApiUsage(...)` → `await` (garante INSERT antes do stream fechar; reforço serverless).

### Testes
- `src/server/actions/consultation.test.ts` — bloco `abandonConsultation` reescrito para a regra via banco (`audio_attempts`).
- `src/app/(session)/app/consultation/[id]/consultation-page-flow.test.tsx` — props novas + teste de regressão do F5 (com `creditAlreadyDebited` o abandono chama o servidor).
- Resultado: 3 arquivos, 51 testes passando.

### Docs
- `docs/architecture.md` — seção de créditos atualizada: estorno é decidido pelo banco (`debit_source` + `audio_attempts`); diagrama ajustado.

## Princípio reforçado

**O banco é a única fonte de verdade.** Decisões de dinheiro/estado vêm do servidor a partir do banco, nunca de `useState` do cliente — sobrevivem a F5, queda de rede e fechamento de aba.

## Dívida técnica relacionada (não resolvida aqui)
- Atendimento `in_progress` órfão (aba fechada sem clicar Abandonar) ainda não é reconciliado automaticamente — o crédito só é devolvido quando algum abandono é disparado. Reconciliação automática (job ou na reentrada) fica como evolução futura.
- `debit_credit(p_user_id)` órfã no prod pode ser dropada numa limpeza futura.
