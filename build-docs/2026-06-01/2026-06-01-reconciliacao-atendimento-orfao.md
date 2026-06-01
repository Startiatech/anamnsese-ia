# Reconciliação de atendimento órfão (invariante: `in_progress` nunca fica preso)

**Data:** 2026-06-01
**Branch:** melhorando-ui-gravacao
**Plano:** `docs/superpowers/plans/2026-06-01-reconciliacao-atendimento-orfao.md`

## Contexto / problema

Após corrigir o estorno via banco no F5 (build anterior do dia), restava a dívida: um atendimento podia ficar preso em `in_progress` com crédito reservado quando o usuário fechava a aba / a rede caía / abandonava sem clicar em "Abandonar". O único caminho que resolvia o atendimento era o clique manual.

**Invariante definido com o usuário:** um atendimento só permanece `in_progress` enquanto for retomável. Quando o médico segue em frente ou o tempo estoura, o atendimento resolve para estado terminal — devolvendo o crédito se não houve uso de IA. Fonte de verdade = banco.

**Estados (mantidos, sem migration):** `in_progress` (crédito reservado/retomável) · `abandoned` (encerrado sem anamnese) · `completed` (gerou anamnese/histórico).

## Decisões de produto

- **Volta para `completed` ao resolver, se já havia anamnese anterior** — preserva o histórico clínico (evita o bug latente de um novo abandono apagar da visão uma anamnese concluída).
- **Dois gatilhos de reconciliação, sem cron/websocket:**
  1. **Ao iniciar outro atendimento:** resolve `in_progress` SEM IA de outros pacientes (conservador — não descarta trabalho em andamento).
  2. **TTL de 24h no load do dashboard:** rede de proteção para quem fechou tudo e voltou só ao dashboard. 24h é folgado para não matar retomada legítima.
- Retomar o **mesmo** paciente continua intocado.

## Implementação (TDD, commits atômicos)

| Commit | Conteúdo |
| --- | --- |
| `89aeaa2` | `src/lib/consultation-state.ts` — função pura `resolveTerminalState` (estado terminal + devolução) + 6 testes |
| `b6fc1f4` | `abandonConsultation` usa o helper; volta a `completed` se havia anamnese; não carimba mais `created_at`/`updated_at` |
| `351fdc2` | `reconcileOrphanConsultations(exceptPatientId)` — resolve `in_progress` sem IA dos demais pacientes |
| `7f35844` | `debitConsultationCredit` dispara a reconciliação ao iniciar atendimento (gatilho 1) |
| `0123fd5` | `reconcileStaleConsultations()` (TTL 24h) + hook no dashboard (gatilho 2) |

## Arquivos

- **Criado:** `src/lib/consultation-state.ts` (+ teste)
- **Modificado:** `src/server/actions/consultation.ts` (abandono + 2 ações de reconciliação) e seu teste
- **Modificado:** `src/app/(app)/app/dashboard/page.tsx` (hook do TTL antes do `Promise.all`)
- **Modificado:** `docs/architecture.md` (seção de créditos — reconciliação documentada)

## Testes

854 testes passando (114 suites). A lógica de decisão fica isolada e 100% testável na função pura `resolveTerminalState`; as ações de reconciliação têm testes com Supabase mockado (padrão hoisted do projeto).

## Sem migration

Não altera schema — usa os 3 estados e colunas já existentes (`debit_source`, `audio_attempts`, `structured_anamnesis`, `updated_at`). Nada a rodar em prod/dev.

## Seam para Fase 2 (timeline de eventos)

A resolução (`resolveTerminalState` + os pontos que aplicam o update) é o único choke point onde a Fase 2 vai emitir `activity_events` (paciente cadastrado/deletado, atendimento completado/interrompido). A "Atividade recente" do dashboard vira uma timeline rotulada read-only consumindo esses eventos. Plano separado.
