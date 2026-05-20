# Spec: Cobertura de testes do fluxo de atendimento completo

**Data:** 2026-04-09
**Status:** Aprovado
**Escopo:** Testes unitários para as lacunas identificadas no fluxo debit → transcribe → anamnese → refine → histórico

---

## Contexto

O fluxo de atendimento já tem cobertura parcial. Este spec define os casos de teste que faltam para garantir que o usuário não tenha surpresas nos caminhos críticos: debit de crédito, transcrição com quota, geração de anamnese, refinamento e exibição do histórico.

---

## Arquivos e casos de teste

### 1. `src/server/actions/consultation.test.ts` — adições

Função: `debitConsultationCredit(patientId)`

| Caso | Comportamento esperado |
|---|---|
| Unauthenticated | Retorna `{ error: 'Não autenticado' }` sem chamar RPC |
| `credits_remaining = 0` | Retorna `{ error: 'Créditos insuficientes' }` sem chamar RPC |
| `credits_remaining >= 1` | Chama `debit_user_credit` RPC com `p_user_id` correto |
| `credits_remaining >= 1` | Faz upsert na tabela `consultations` com `status: 'in_progress'`, `current_step: 2`, `raw_transcript: null` |
| `credits_remaining >= 1` | Retorna `{}` (sem erro) |

**Padrão:** `// @vitest-environment node`, `vi.hoisted`, mock `@/server/supabase` + `@/server/services/session`.

---

### 2. `src/app/api/auth/me/debit/route.test.ts` — novo

Rota: `POST /api/auth/me/debit`

| Caso | Comportamento esperado |
|---|---|
| Sem token / token inválido | 401 |
| Token válido | 200 `{ ok: true }` + `debitCredit` chamado com `payload.sub` |

**Padrão:** `// @vitest-environment node`, mock `@/lib/auth` (verifyToken + COOKIE_NAME) + `@/server/repositories/credits` (CreditRepository.debitCredit). Seguir exatamente o padrão do `credit/route.test.ts` já existente.

---

### 3. `src/app/api/transcribe/route.test.ts` — adição

Caso faltante na suíte existente:

| Caso | Comportamento esperado |
|---|---|
| `audio_attempts >= limit` | 403 `{ error: 'Cota de tentativas esgotada.' }` |

Mock do Supabase deve retornar `audio_attempts: 2` e plan com `f5.limit: 2`.

---

### 4. `src/app/api/anamnesis/route.test.ts` — novo

Rota: `POST /api/anamnesis`

| Caso | Comportamento esperado |
|---|---|
| Sem auth | 401 |
| Body sem `patientId` | 400 |
| Body sem `transcript` | 400 |
| Groq retorna JSON com `sections` válido | 200 com `{ sections: [...] }` + `clearTranscript` chamado |
| Groq retorna JSON malformado (não parseável) | 500 com mensagem de erro — sem vazar stack trace |

**Mock do Groq:**
```ts
vi.mock('groq-sdk', () => ({
  default: class Groq {
    chat = { completions: { create: mockGroqCreate } }
  },
}))
```
`mockGroqCreate` retorna `{ choices: [{ message: { content: JSON.stringify({ sections: [...] }) } }] }`.

Para o caso de JSON malformado: `mockGroqCreate` retorna `{ choices: [{ message: { content: 'não é json' } }] }`.

`clearTranscript` é mockado via `vi.mock('@/server/actions/consultation', ...)`.

---

### 5. `src/app/api/anamnesis/refine/route.test.ts` — novo

Rota: `POST /api/anamnesis/refine`

| Caso | Comportamento esperado |
|---|---|
| Sem auth | 401 |
| Body sem `sections` | 400 |
| Body sem `instruction` | 400 |
| Body sem `patientId` | 400 |
| RPC lança `refinement_quota_exceeded` | 429 `{ error: 'Limite de refinamentos atingido...' }` |
| RPC lança `consultation_not_found` | 404 |
| Groq retorna sections refinadas | 200 `{ sections: [...] }` |

**Mock do RPC:** Supabase mock para `increment_refinement_attempt` — sucesso retorna `{ data: 1, error: null }`, quota exceeded retorna `{ data: null, error: { message: 'refinement_quota_exceeded' } }`.

---

### 6. `src/app/api/patients/[id]/route.test.ts` — adições

Rota: `GET /api/patients/[id]/latest-consultation`

| Caso | Comportamento esperado |
|---|---|
| Sem auth | 401 |
| Consulta encontrada | 200 com objeto `Consultation` completo |
| Nenhuma consulta | 404 |

**Nota:** verificar como a rota atual implementa este endpoint para alinhar o mock do Supabase com a query real.

---

## Padrões obrigatórios

1. **`vi.hoisted`** para todos os mocks que precisam ser elevados antes do import
2. **`// @vitest-environment node`** em todos os arquivos de API route e Server Action
3. **`vi.mock('next/server')`** com `NextResponse.json` manual (seguir padrão existente)
4. **`vi.clearAllMocks()` no `beforeEach`** de todo describe
5. `status` sempre explícito nos matchers — nunca depender do default 200
6. Mocks do Groq: retornar estrutura mínima (`choices[0].message.content`) — não simular latência

---

## Fora do escopo

- Testes E2E ou de integração real com Supabase/Groq
- Testes de componentes para `StepAudio` ou `StepAnamnesis` (fluxo de UI)
- Cobertura de `refund_user_credit` (já coberta em `abandonConsultation`)

---

## Critério de sucesso

`npm test` passa 100% com os novos casos incluídos. Nenhum teste usa `setTimeout` ou depende de ordem de execução.
