# "Ver anamnese" 404 + gate por anamnese real

Data: 2026-05-28
Branch: `development`

Reportado em teste manual: clicar em "Ver anamnese" de um paciente caía em **404**
(`/app/result/{id}`), e o paciente não aparecia no histórico. Investigação confirmou a
causa e o requisito de produto.

## Diagnóstico

Modelo intencional: **1 consulta por paciente** (`onConflict: 'user_id,patient_id'`) — o
sistema é ferramenta de **apoio** (o profissional exporta o PDF/DOCX e leva pro ERP dele),
não gestão de pacientes. Mantém-se apenas a **última anamnese**.

Auditoria mostrou que **nenhum** caminho do código grava `structured_anamnesis = null`
(único writer é `ConsultationRepository.save`, na conclusão). `debitConsultationCredit`
(iniciar) e `abandonConsultation` (abandonar) **não tocam** nesse campo. Ou seja, iniciar/
abandonar **não destroem** a anamnese anterior.

O 404 vinha de `findLatestByPatientId`, que retornava a consulta **mais recente por
`created_at` sem filtrar** `structured_anamnesis`. Num paciente cujo (único) registro era
um atendimento abandonado na transcrição (sem anamnese), "Ver anamnese" abria essa linha →
`result` fazia `notFound()`. E o botão era exibido com base em `consultationCount > 0`, que
conta atendimentos abandonados também → clique morto.

## Correções (Opção "guard", sem mudança de schema)

- [src/server/repositories/db.ts](src/server/repositories/db.ts) — `findLatestByPatientId` filtra `.not('structured_anamnesis','is',null)` e usa `maybeSingle()`. "Ver anamnese" abre a última anamnese real; sem anamnese, o endpoint retorna 404 limpo → toast *"Nenhuma anamnese encontrada"* em vez da página 404.
- [src/server/repositories/db.ts](src/server/repositories/db.ts) — `findAllWithStats` passa a derivar `hasAnamnesis` (set de `patient_id` com `structured_anamnesis` não-nulo), via `select` já existente acrescido do campo.
- [src/types/index.ts](src/types/index.ts) — `PatientWithStats.hasAnamnesis: boolean`.
- [src/components/consultation/patient-row-actions.tsx](src/components/consultation/patient-row-actions.tsx) — "Ver última anamnese" passa a aparecer só quando `patient.hasAnamnesis` (não mais `consultationCount > 0`).
- [src/components/consultation/consultation-page-client.tsx](src/components/consultation/consultation-page-client.tsx) — paciente recém-criado nasce com `hasAnamnesis: false`.

Histórico já filtrava `.not('structured_anamnesis','is',null)` — paciente sem anamnese já
não aparecia; comportamento mantido.

## Testes (TDD)

- `db.findLatestByPatientId.test.ts` (novo) — filtra por anamnese; null quando não há; mapeia quando há.
- `db.findAllWithStats.test.ts` — `hasAnamnesis` true/false.
- `patient-row-actions.test.tsx` — gate por `hasAnamnesis` (some mesmo com atendimento abandonado).
- `consultation.test.ts` — iniciar/abandonar **não** incluem `structured_anamnesis` no upsert (trava a preservação).

## Item d — RPC ausente (migration criada)

A RPC `save_transcript_and_increment` **não existia** em nenhum dos bancos (confirmado:
0 linhas no prod e ausente no `seed-test-schema.sql`). `supabase.rpc(...)` em
`saveTranscriptAndIncrementAttempts` falhava em silêncio → transcrição não salva +
`audio_attempts` não incrementava (cota não decrementava).

Criada a migration [supabase/migrations/20260528_save_transcript_and_increment.sql](supabase/migrations/20260528_save_transcript_and_increment.sql)
(`CREATE OR REPLACE`, recupera a definição original do plano de 2026-04-04). A função faz
apenas `raw_transcript` + `audio_attempts + 1` + `updated_at` — **não** toca em
`structured_anamnesis`.

**Ação manual obrigatória:** aplicar o SQL nos **2 bancos** — prod
(`anamnese-ia-com-claude-code--prod`) e teste (`anamnese-ia-com-claude-code--teste`).
