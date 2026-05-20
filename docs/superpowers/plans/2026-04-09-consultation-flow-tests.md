# Consultation Flow Tests — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar cobertura de testes unitários para o fluxo completo de atendimento: debit de crédito, transcrição (quota), geração de anamnese, refinamento e histórico (latest-consultation).

**Architecture:** Testes unitários com `vi.hoisted` + mocks de Supabase, Groq e session. Nenhum arquivo de produção é alterado. Cada task escreve o teste falhando, implementa (nada — os sources já existem), confirma verde e commita.

**Tech Stack:** Vitest · `@testing-library/react` · `vi.hoisted` · `vi.mock` · `// @vitest-environment node`

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| `src/server/actions/consultation.test.ts` | Modificar — adicionar `mockSingle` e describe `debitConsultationCredit` |
| `src/app/api/auth/me/debit/route.test.ts` | Criar |
| `src/app/api/transcribe/route.test.ts` | Modificar — adicionar caso 403 |
| `src/app/api/anamnesis/route.test.ts` | Criar |
| `src/app/api/anamnesis/refine/route.test.ts` | Criar |
| `src/app/api/patients/[id]/latest-consultation/route.test.ts` | Criar |

---

## Task 1: `debitConsultationCredit` — adicionar ao consultation.test.ts

**Files:**
- Modify: `src/server/actions/consultation.test.ts`

> O mock atual não extrai `single` como variável nomeada. Precisamos de controle sobre ele para simular créditos insuficientes.

- [ ] **Step 1: Adicionar `mockSingle` ao `vi.hoisted` e atualizar o mock do Supabase**

Localizar o bloco `vi.hoisted` existente e substituir por:

```ts
const { mockGetServerUser, mockUpsert, mockUpdate, mockRpc, mockSingle } = vi.hoisted(() => ({
  mockGetServerUser: vi.fn(),
  mockUpsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockRpc: vi.fn(),
  mockSingle: vi.fn(),
}))
```

Localizar o `vi.mock('@/server/supabase', ...)` existente e substituir o `single` inline por `single: mockSingle`:

```ts
vi.mock('@/server/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: mockSingle,
        }),
      }),
      upsert: mockUpsert,
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: mockUpdate,
        }),
      }),
    }),
    rpc: mockRpc,
  },
}))
```

- [ ] **Step 2: Adicionar `mockSingle` ao `beforeEach` dos describes existentes**

Nos describes `abandonConsultation` e `saveTranscriptAndIncrementAttempts` e `clearTranscript`, o `beforeEach` não usava `mockSingle` — não precisa de ajuste. Mas adicionar o default ao `beforeEach` global (antes dos describes) para não quebrar os testes existentes:

```ts
// Adicionar no beforeEach do describe abandonConsultation (já existente):
mockSingle.mockResolvedValue({ data: { credits_remaining: 5 }, error: null })
```

- [ ] **Step 3: Escrever o describe `debitConsultationCredit` (failing)**

Adicionar ao final do arquivo, antes do fechamento:

```ts
import { debitConsultationCredit } from './consultation'

describe('debitConsultationCredit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetServerUser.mockResolvedValue({ sub: 'user-1' })
    mockSingle.mockResolvedValue({ data: { credits_remaining: 5 }, error: null })
    mockRpc.mockResolvedValue({ data: null, error: null })
    mockUpsert.mockResolvedValue({ error: null })
  })

  it('returns error when unauthenticated', async () => {
    mockGetServerUser.mockResolvedValue(null)
    const result = await debitConsultationCredit('patient-1')
    expect(result).toEqual({ error: 'Não autenticado' })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('returns error when credits_remaining is 0', async () => {
    mockSingle.mockResolvedValue({ data: { credits_remaining: 0 }, error: null })
    const result = await debitConsultationCredit('patient-1')
    expect(result).toEqual({ error: 'Créditos insuficientes' })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('returns error when userData is null', async () => {
    mockSingle.mockResolvedValue({ data: null, error: null })
    const result = await debitConsultationCredit('patient-1')
    expect(result).toEqual({ error: 'Créditos insuficientes' })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('calls debit_user_credit RPC with correct user id', async () => {
    await debitConsultationCredit('patient-1')
    expect(mockRpc).toHaveBeenCalledWith('debit_user_credit', { p_user_id: 'user-1' })
  })

  it('upserts consultation with status in_progress at step 2', async () => {
    await debitConsultationCredit('patient-1')
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        patient_id: 'patient-1',
        status: 'in_progress',
        current_step: 2,
        raw_transcript: null,
      }),
      expect.objectContaining({ onConflict: 'user_id,patient_id' }),
    )
  })

  it('returns empty object on success', async () => {
    const result = await debitConsultationCredit('patient-1')
    expect(result).toEqual({})
  })
})
```

- [ ] **Step 4: Rodar os testes e confirmar RED → GREEN**

```bash
npx vitest run src/server/actions/consultation.test.ts --reporter=verbose
```

Esperado: todos os casos do describe `debitConsultationCredit` passam. Os describes existentes (`abandonConsultation`, etc.) também devem continuar passando.

- [ ] **Step 5: Commit**

```bash
git add src/server/actions/consultation.test.ts
git commit -m "test(actions): add debitConsultationCredit coverage"
```

---

## Task 2: `POST /api/auth/me/debit` — novo arquivo de teste

**Files:**
- Create: `src/app/api/auth/me/debit/route.test.ts`

> Segue exatamente o padrão de `src/app/api/auth/me/credit/route.test.ts`.

- [ ] **Step 1: Criar o arquivo de teste**

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockDebitCredit, mockVerifyToken } = vi.hoisted(() => ({
  mockDebitCredit: vi.fn(),
  mockVerifyToken: vi.fn(),
}))

vi.mock('@/server/repositories/credits', () => ({
  CreditRepository: {
    debitCredit: mockDebitCredit,
  },
}))

vi.mock('@/lib/auth', () => ({
  verifyToken: mockVerifyToken,
  COOKIE_NAME: 'anamnese_auth',
}))

vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => ({
      json: async () => data,
      status: init?.status ?? 200,
    }),
  },
}))

import { POST } from './route'

function makeRequest(token: string | null): any {
  return {
    cookies: {
      get: (name: string) => {
        if (name === 'anamnese_auth' && token) return { name, value: token }
        return undefined
      },
    },
  }
}

describe('POST /api/auth/me/debit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no token', async () => {
    mockVerifyToken.mockResolvedValue(null)
    const res = await POST(makeRequest(null))
    expect(res.status).toBe(401)
  })

  it('returns 401 when token is invalid', async () => {
    mockVerifyToken.mockResolvedValue(null)
    const res = await POST(makeRequest('invalid'))
    expect(res.status).toBe(401)
  })

  it('calls debitCredit with correct user id and returns 200', async () => {
    const payload = { sub: 'user-1', name: 'Dr. Ana', email: 'ana@clinic.com', role: 'user' }
    mockVerifyToken.mockResolvedValue(payload)
    mockDebitCredit.mockResolvedValue(undefined)

    const res = await POST(makeRequest('valid-token'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true })
    expect(mockDebitCredit).toHaveBeenCalledWith('user-1')
  })
})
```

- [ ] **Step 2: Rodar e confirmar verde**

```bash
npx vitest run src/app/api/auth/me/debit/route.test.ts --reporter=verbose
```

Esperado: 3 testes passando.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/me/debit/route.test.ts
git commit -m "test(api): add POST /api/auth/me/debit coverage"
```

---

## Task 3: `POST /api/transcribe` — adicionar caso 403 quota

**Files:**
- Modify: `src/app/api/transcribe/route.test.ts`

- [ ] **Step 1: Localizar o mock do Supabase no arquivo existente**

O mock atual diferencia tabelas assim:
```ts
vi.mock('@/server/supabase', () => ({
  supabase: {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'consultations') { ... }
      if (table === 'users') { ... }
      if (table === 'plans') { ... }
      return {}
    }),
  },
}))
```

- [ ] **Step 2: Adicionar o caso 403 ao describe existente**

Dentro do describe `POST /api/transcribe`, adicionar após os casos existentes:

```ts
it('returns 403 when audio_attempts >= plan limit', async () => {
  // Override do mock de consultations para retornar attempts = 2 (igual ao limit)
  const { supabase } = await import('@/server/supabase')
  ;(supabase.from as ReturnType<typeof vi.fn>).mockImplementationOnce((table: string) => {
    if (table === 'consultations') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { audio_attempts: 2 } }),
            }),
          }),
        }),
      }
    }
    // outras tabelas mantêm o mock padrão
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { plan_id: 'experimental' } }),
        }),
      }),
    }
  })

  const res = await POST(makeFormData(makeFile('audio.mp3')) as never)
  expect(res.status).toBe(403)
  const json = await res.json()
  expect(json.error).toBe('Cota de tentativas esgotada.')
})
```

> **Nota:** Se o mock do Supabase não usar `mockImplementationOnce`, usar `vi.mocked(supabase.from).mockImplementationOnce(...)` ou reescrever o mock para usar uma variável extraída via `vi.hoisted`. Inspecionar o arquivo existente e adaptar conforme o padrão lá encontrado.

- [ ] **Step 3: Rodar e confirmar verde**

```bash
npx vitest run src/app/api/transcribe/route.test.ts --reporter=verbose
```

Esperado: todos os casos existentes + o novo 403 passam.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/transcribe/route.test.ts
git commit -m "test(api): add 403 quota case to transcribe route"
```

---

## Task 4: `POST /api/anamnesis` — novo arquivo de teste

**Files:**
- Create: `src/app/api/anamnesis/route.test.ts`

> A rota não usa Supabase. Apenas session + Groq. Retorna 502 (não 500) para JSON malformado — isso é intencional (erro de upstream).

- [ ] **Step 1: Criar o arquivo de teste**

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetServerUser, mockGroqCreate } = vi.hoisted(() => ({
  mockGetServerUser: vi.fn(),
  mockGroqCreate: vi.fn(),
}))

vi.mock('@/server/services/session', () => ({
  getServerUser: mockGetServerUser,
}))

vi.mock('groq-sdk', () => ({
  default: class Groq {
    chat = { completions: { create: mockGroqCreate } }
  },
}))

vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => ({
      json: async () => data,
      status: init?.status ?? 200,
    }),
  },
}))

import { POST } from './route'

function makeRequest(body: unknown): any {
  return { json: async () => body }
}

const validBody = {
  transcript: 'Paciente relata dor de cabeça há 3 dias.',
  sections: ['Queixa principal', 'História da moléstia atual'],
}

const groqSections = [
  { title: 'Queixa principal', content: 'Cefaleia há 3 dias.' },
  { title: 'História da moléstia atual', content: 'Dor progressiva, sem febre.' },
]

describe('POST /api/anamnesis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GROQ_API_KEY = 'test-key'
    mockGetServerUser.mockResolvedValue({ sub: 'user-1' })
    mockGroqCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ sections: groqSections }) } }],
    })
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetServerUser.mockResolvedValue(null)
    const res = await POST(makeRequest(validBody) as never)
    expect(res.status).toBe(401)
  })

  it('returns 400 when transcript is missing', async () => {
    const res = await POST(makeRequest({ sections: ['Queixa principal'] }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when sections array is empty', async () => {
    const res = await POST(makeRequest({ transcript: 'texto', sections: [] }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 200 with sections when Groq returns valid JSON', async () => {
    const res = await POST(makeRequest(validBody) as never)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sections).toEqual(groqSections)
  })

  it('returns 502 when Groq returns malformed JSON', async () => {
    mockGroqCreate.mockResolvedValue({
      choices: [{ message: { content: 'não é json válido' } }],
    })
    const res = await POST(makeRequest(validBody) as never)
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toBe('Resposta inválida da IA. Tente novamente.')
  })

  it('returns 502 when Groq returns JSON without sections array', async () => {
    mockGroqCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ other: 'field' }) } }],
    })
    const res = await POST(makeRequest(validBody) as never)
    expect(res.status).toBe(502)
  })

  it('returns 503 when GROQ_API_KEY is not set', async () => {
    const original = process.env.GROQ_API_KEY
    delete process.env.GROQ_API_KEY
    try {
      const res = await POST(makeRequest(validBody) as never)
      expect(res.status).toBe(503)
    } finally {
      process.env.GROQ_API_KEY = original
    }
  })
})
```

- [ ] **Step 2: Rodar e confirmar verde**

```bash
npx vitest run src/app/api/anamnesis/route.test.ts --reporter=verbose
```

Esperado: 7 testes passando.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/anamnesis/route.test.ts
git commit -m "test(api): add POST /api/anamnesis coverage"
```

---

## Task 5: `POST /api/anamnesis/refine` — novo arquivo de teste

**Files:**
- Create: `src/app/api/anamnesis/refine/route.test.ts`

> A rota chama `supabase.rpc('increment_refinement_attempt', ...)` antes do Groq. Retorna `refinementCount` junto com `sections`.

- [ ] **Step 1: Criar o arquivo de teste**

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetServerUser, mockGroqCreate, mockRpc } = vi.hoisted(() => ({
  mockGetServerUser: vi.fn(),
  mockGroqCreate: vi.fn(),
  mockRpc: vi.fn(),
}))

vi.mock('@/server/services/session', () => ({
  getServerUser: mockGetServerUser,
}))

vi.mock('@/server/supabase', () => ({
  supabase: { rpc: mockRpc },
}))

vi.mock('groq-sdk', () => ({
  default: class Groq {
    chat = { completions: { create: mockGroqCreate } }
  },
}))

vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => ({
      json: async () => data,
      status: init?.status ?? 200,
    }),
  },
}))

import { POST } from './route'

function makeRequest(body: unknown): any {
  return { json: async () => body }
}

const validBody = {
  sections: [
    { title: 'Queixa principal', content: 'Cefaleia há 3 dias.' },
  ],
  instruction: 'Reescreva a queixa em linguagem mais formal.',
  patientId: 'patient-1',
}

const refinedSections = [
  { title: 'Queixa principal', content: 'O paciente refere cefaleia com duração de três dias.' },
]

describe('POST /api/anamnesis/refine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GROQ_API_KEY = 'test-key'
    mockGetServerUser.mockResolvedValue({ sub: 'user-1' })
    mockRpc.mockResolvedValue({ data: 1, error: null })
    mockGroqCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ sections: refinedSections }) } }],
    })
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetServerUser.mockResolvedValue(null)
    const res = await POST(makeRequest(validBody) as never)
    expect(res.status).toBe(401)
  })

  it('returns 400 when sections is missing', async () => {
    const res = await POST(makeRequest({ instruction: 'x', patientId: 'p-1' }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when instruction is blank', async () => {
    const res = await POST(makeRequest({ ...validBody, instruction: '   ' }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when patientId is missing', async () => {
    const res = await POST(makeRequest({ sections: validBody.sections, instruction: 'x' }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 429 when RPC signals quota exceeded', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'refinement_quota_exceeded' },
    })
    const res = await POST(makeRequest(validBody) as never)
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toContain('Limite de refinamentos')
  })

  it('returns 404 when RPC signals consultation not found', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'consultation_not_found' },
    })
    const res = await POST(makeRequest(validBody) as never)
    expect(res.status).toBe(404)
  })

  it('returns 200 with refined sections and refinementCount', async () => {
    const res = await POST(makeRequest(validBody) as never)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sections).toEqual(refinedSections)
    expect(body.refinementCount).toBe(1)
  })

  it('calls increment_refinement_attempt with correct params', async () => {
    await POST(makeRequest(validBody) as never)
    expect(mockRpc).toHaveBeenCalledWith('increment_refinement_attempt', {
      p_user_id: 'user-1',
      p_patient_id: 'patient-1',
    })
  })

  it('returns 502 when Groq returns malformed JSON', async () => {
    mockGroqCreate.mockResolvedValue({
      choices: [{ message: { content: 'não é json' } }],
    })
    const res = await POST(makeRequest(validBody) as never)
    expect(res.status).toBe(502)
  })
})
```

- [ ] **Step 2: Rodar e confirmar verde**

```bash
npx vitest run src/app/api/anamnesis/refine/route.test.ts --reporter=verbose
```

Esperado: 9 testes passando.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/anamnesis/refine/route.test.ts
git commit -m "test(api): add POST /api/anamnesis/refine coverage"
```

---

## Task 6: `GET /api/patients/[id]/latest-consultation` — novo arquivo de teste

**Files:**
- Create: `src/app/api/patients/[id]/latest-consultation/route.test.ts`

> A rota usa `ConsultationRepository.findLatestByPatientId(user.sub, patientId)`. Mockar `@/server/repositories/db`.

- [ ] **Step 1: Criar o arquivo de teste**

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetServerUser, mockFindLatest } = vi.hoisted(() => ({
  mockGetServerUser: vi.fn(),
  mockFindLatest: vi.fn(),
}))

vi.mock('@/server/services/session', () => ({
  getServerUser: mockGetServerUser,
}))

vi.mock('@/server/repositories/db', () => ({
  ConsultationRepository: {
    findLatestByPatientId: mockFindLatest,
  },
}))

vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => ({
      json: async () => data,
      status: init?.status ?? 200,
    }),
  },
}))

import { GET } from './route'

function makeParams(id: string): any {
  return { params: Promise.resolve({ id }) }
}

const mockConsultation = {
  id: 'cons-1',
  patientId: 'patient-1',
  userId: 'user-1',
  status: 'completed',
  structuredAnamnesis: {
    sections: [
      { title: 'Queixa principal', content: 'Cefaleia há 3 dias.' },
    ],
  },
}

describe('GET /api/patients/[id]/latest-consultation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetServerUser.mockResolvedValue({ sub: 'user-1' })
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetServerUser.mockResolvedValue(null)
    const res = await GET({} as never, makeParams('patient-1'))
    expect(res.status).toBe(401)
  })

  it('returns 404 when no consultation found', async () => {
    mockFindLatest.mockResolvedValue(null)
    const res = await GET({} as never, makeParams('patient-1'))
    expect(res.status).toBe(404)
  })

  it('returns 200 with consultation data when found', async () => {
    mockFindLatest.mockResolvedValue(mockConsultation)
    const res = await GET({} as never, makeParams('patient-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(mockConsultation)
  })

  it('calls findLatestByPatientId with correct user and patient ids', async () => {
    mockFindLatest.mockResolvedValue(mockConsultation)
    await GET({} as never, makeParams('patient-1'))
    expect(mockFindLatest).toHaveBeenCalledWith('user-1', 'patient-1')
  })
})
```

- [ ] **Step 2: Rodar e confirmar verde**

```bash
npx vitest run src/app/api/patients/[id]/latest-consultation/route.test.ts --reporter=verbose
```

Esperado: 4 testes passando.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/patients/[id]/latest-consultation/route.test.ts
git commit -m "test(api): add GET latest-consultation coverage"
```

---

## Task 7: Rodar suite completa e confirmar 100%

- [ ] **Step 1: Rodar todos os testes**

```bash
npx vitest run
```

Esperado:
```
Test Files  30 passed (30)
     Tests  ~160 passed (~160)
```

- [ ] **Step 2: Confirmar zero falhas e commitar se necessário**

Se algum teste falhar por conflito de mock (ex: `from` do Supabase em Task 1 quebrando testes existentes), ajustar o `mockSingle` default no `beforeEach` dos describes afetados.

---

## Self-review

**Spec coverage:**
- `debitConsultationCredit` (unauthenticated, créditos 0, créditos null, RPC chamado, upsert, retorno vazio) → Task 1 ✅
- `POST /api/auth/me/debit` (401, 200 + debit) → Task 2 ✅
- `POST /api/transcribe` 403 quota → Task 3 ✅
- `POST /api/anamnesis` (401, 400, 200 válido, 502 malformado, 502 sem array, 503) → Task 4 ✅
- `POST /api/anamnesis/refine` (401, 400×3, 429, 404, 200, RPC params, 502) → Task 5 ✅
- `GET /latest-consultation` (401, 404, 200, params corretos) → Task 6 ✅

**Placeholders:** Nenhum TBD ou TODO.

**Type consistency:** `mockGroqCreate`, `mockGetServerUser`, `mockRpc` — nomes consistentes em todas as tasks. `makeRequest` helper usado em Tasks 4 e 5 com mesma assinatura.
