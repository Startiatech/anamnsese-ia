# Transcription Streaming + Quota + Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar streaming em tempo real da transcrição via ReadableStream, controle de cota de tentativas de áudio por plano com persistência no banco, e limpeza do transcript por privacidade ao finalizar o atendimento.

**Architecture:** A rota `POST /api/transcribe` passa a retornar um `ReadableStream` emitindo texto por chunk. O banco rastreia `audio_attempts` por consulta e `f5.limit` por plano. O transcript é salvo após cada transcrição bem-sucedida e limpo quando o atendimento é finalizado ou abandonado. O `StepAudio` é redesenhado com estados `idle → streaming → done` e exibição de cota.

**Tech Stack:** Next.js 16 App Router (Node.js runtime), ReadableStream Web API, `groq-sdk`, Supabase, Vitest (`@vitest-environment node`), React `useState`

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| `src/server/repositories/plans.ts` | Modificar — adicionar `limit` ao tipo `PlanFeature` |
| `src/server/actions/consultation.ts` | Modificar — corrigir `abandonConsultation`, adicionar `saveTranscriptAndIncrementAttempts`, `clearTranscript` |
| `src/lib/transcribe-chunks.ts` | Modificar — adicionar parâmetro `onChunk` |
| `src/lib/transcribe-chunks.test.ts` | Modificar — testar `onChunk` |
| `src/app/api/transcribe/route.ts` | Modificar — streaming ReadableStream + quota check |
| `src/app/api/transcribe/route.test.ts` | Modificar — adaptar para streaming |
| `src/app/(session)/consultation/[id]/page.tsx` | Modificar — buscar `audio_attempts`, `f5.limit`, `raw_transcript` |
| `src/context/consultation-context.tsx` | Modificar — aceitar `initialTranscript` |
| `src/app/(session)/consultation/[id]/consultation-page-flow.tsx` | Modificar — passar novos props ao `StepAudio` |
| `src/components/steps/step-audio.tsx` | Modificar — redesign completo com streaming UI |
| `src/hooks/use-consultation.ts` | Modificar — chamar `clearTranscript` após salvar |

---

## Task 1: Migrations no banco — `f5.limit` + RPC

**Files:**
- Supabase migrations via MCP

- [ ] **Step 1: Aplicar migration — adicionar `limit` ao `f5` nos planos**

Executar via MCP `apply_migration`:

```sql
-- Plano experimental: limit = 2
UPDATE plans SET features = (
  SELECT jsonb_agg(
    CASE
      WHEN f->>'id' = 'f5' THEN f || '{"limit": 2}'::jsonb
      ELSE f
    END
  )
  FROM jsonb_array_elements(features) AS f
) WHERE id = 'experimental';

-- Plano profissional: limit = null (ilimitado)
UPDATE plans SET features = (
  SELECT jsonb_agg(
    CASE
      WHEN f->>'id' = 'f5' THEN f || '{"limit": null}'::jsonb
      ELSE f
    END
  )
  FROM jsonb_array_elements(features) AS f
) WHERE id = 'profissional';
```

- [ ] **Step 2: Aplicar migration — criar RPC `save_transcript_and_increment`**

```sql
CREATE OR REPLACE FUNCTION save_transcript_and_increment(
  p_user_id uuid,
  p_patient_id uuid,
  p_transcript text
) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE consultations
  SET
    raw_transcript = p_transcript,
    audio_attempts = audio_attempts + 1,
    updated_at = now()
  WHERE user_id = p_user_id AND patient_id = p_patient_id;
$$;
```

- [ ] **Step 3: Verificar resultado**

```sql
SELECT id, features->0->>'id', features FROM plans WHERE id IN ('experimental', 'profissional');
```

Esperado: objetos `f5` com campo `limit: 2` e `limit: null` respectivamente.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add f5.limit to plans and save_transcript_and_increment RPC"
```

---

## Task 2: Tipos e Server Actions

**Files:**
- Modify: `src/server/repositories/plans.ts`
- Modify: `src/server/actions/consultation.ts`

- [ ] **Step 1: Atualizar tipo `PlanFeature` em `src/server/repositories/plans.ts`**

Substituir a interface:

```ts
export interface PlanFeature {
  id: string
  label: string
  active: boolean
  limit?: number | null  // null = ilimitado, number = máximo de tentativas
}
```

- [ ] **Step 2: Atualizar `src/server/actions/consultation.ts`**

Substituir o conteúdo completo do arquivo:

```ts
'use server'

import { supabase } from '@/server/supabase'
import { getServerUser } from '@/server/services/session'
import type { ConsultationStep } from '@/types'

export async function debitConsultationCredit(patientId: string): Promise<{ error?: string }> {
  const user = await getServerUser()
  if (!user) return { error: 'Não autenticado' }

  const { data: userData } = await supabase
    .from('users')
    .select('credits_remaining')
    .eq('id', user.sub)
    .single()

  if (!userData || (userData.credits_remaining as number) < 1) {
    return { error: 'Créditos insuficientes' }
  }

  await supabase.rpc('debit_user_credit', { p_user_id: user.sub })

  await supabase.from('consultations').upsert(
    {
      user_id: user.sub,
      patient_id: patientId,
      status: 'in_progress',
      current_step: 2,
      audio_attempts: 0,
      refinement_attempts: 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,patient_id' },
  )

  return {}
}

export async function abandonConsultation(
  patientId: string,
  currentStep: ConsultationStep,
  _rawTranscript: string,
  aiWasUsed: boolean,
): Promise<void> {
  const user = await getServerUser()
  if (!user) return

  // raw_transcript is always cleared for privacy on abandonment
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

  if (!aiWasUsed) {
    await supabase.rpc('refund_user_credit', { p_user_id: user.sub })
  }
}

export async function saveTranscriptAndIncrementAttempts(
  patientId: string,
  transcript: string,
): Promise<void> {
  const user = await getServerUser()
  if (!user) return
  await supabase.rpc('save_transcript_and_increment', {
    p_user_id: user.sub,
    p_patient_id: patientId,
    p_transcript: transcript,
  })
}

export async function clearTranscript(patientId: string): Promise<void> {
  const user = await getServerUser()
  if (!user) return
  await supabase
    .from('consultations')
    .update({ raw_transcript: null, updated_at: new Date().toISOString() })
    .eq('user_id', user.sub)
    .eq('patient_id', patientId)
}
```

- [ ] **Step 3: Rodar suite de testes — confirmar sem regressões**

```bash
cd "d:\REPOS-GITHUB-PARTICULAR\project-anamnese-ia-claude-code-repo-local" && npm test 2>&1 | tail -10
```

Esperado: mesma contagem de passes que antes (7 failures pré-existentes são normais).

- [ ] **Step 4: Commit**

```bash
git add src/server/repositories/plans.ts src/server/actions/consultation.ts
git commit -m "feat: add saveTranscriptAndIncrementAttempts and clearTranscript actions"
```

---

## Task 3: Adicionar `onChunk` callback ao `transcribeInChunks`

**Files:**
- Modify: `src/lib/transcribe-chunks.ts`
- Modify: `src/lib/transcribe-chunks.test.ts`

- [ ] **Step 1: Escrever testes para `onChunk` em `src/lib/transcribe-chunks.test.ts`**

Adicionar dentro do `describe('transcribeInChunks', ...)` após os testes existentes:

```ts
  it('calls onChunk once per chunk with the transcribed text', async () => {
    mockCreate
      .mockResolvedValueOnce('parte um')
      .mockResolvedValueOnce('parte dois')
      .mockResolvedValueOnce('parte tres')

    const file = makeFile(45)
    const groq = makeGroq()
    const onChunk = vi.fn()
    await transcribeInChunks(file, groq, onChunk)

    expect(onChunk).toHaveBeenCalledTimes(3)
    expect(onChunk).toHaveBeenNthCalledWith(1, 'parte um')
    expect(onChunk).toHaveBeenNthCalledWith(2, 'parte dois')
    expect(onChunk).toHaveBeenNthCalledWith(3, 'parte tres')
  })

  it('works normally without onChunk (backward compatible)', async () => {
    const file = makeFile(5)
    const groq = makeGroq()
    // no onChunk passed — should not throw
    const result = await transcribeInChunks(file, groq)
    expect(result).toBe('texto transcrito')
  })
```

- [ ] **Step 2: Rodar testes — confirmar FALHAM (RED)**

```bash
cd "d:\REPOS-GITHUB-PARTICULAR\project-anamnese-ia-claude-code-repo-local" && npm test -- src/lib/transcribe-chunks.test.ts 2>&1 | tail -10
```

Esperado: 2 novos testes falhando.

- [ ] **Step 3: Atualizar `src/lib/transcribe-chunks.ts`**

Substituir o conteúdo completo:

```ts
import type Groq from 'groq-sdk'

export const CHUNK_SIZE_BYTES = 20 * 1024 * 1024 // 20MB

export async function transcribeInChunks(
  file: File,
  groq: Groq,
  onChunk?: (text: string) => void,
): Promise<string> {
  const buffer = await file.arrayBuffer()

  if (buffer.byteLength === 0) {
    throw new Error('O arquivo de áudio está vazio.')
  }

  const chunks = splitBuffer(buffer, CHUNK_SIZE_BYTES)

  const transcripts: string[] = []
  for (const chunk of chunks) {
    const chunkFile = new File([chunk], file.name, { type: file.type })
    // Groq SDK does not narrow return type for response_format: 'text'; cast is intentional
    const text = await groq.audio.transcriptions.create({
      file: chunkFile,
      model: 'whisper-large-v3',
      language: 'pt',
      response_format: 'text',
    }) as unknown as string
    transcripts.push(text)
    onChunk?.(text)
  }

  return transcripts.join(' ')
}

function splitBuffer(buffer: ArrayBuffer, chunkSize: number): ArrayBuffer[] {
  const chunks: ArrayBuffer[] = []
  let offset = 0
  while (offset < buffer.byteLength) {
    chunks.push(buffer.slice(offset, offset + chunkSize))
    offset += chunkSize
  }
  return chunks
}
```

- [ ] **Step 4: Rodar testes — confirmar 8 passando (GREEN)**

```bash
cd "d:\REPOS-GITHUB-PARTICULAR\project-anamnese-ia-claude-code-repo-local" && npm test -- src/lib/transcribe-chunks.test.ts 2>&1 | tail -10
```

Esperado: `8 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/transcribe-chunks.ts src/lib/transcribe-chunks.test.ts
git commit -m "feat: add onChunk callback to transcribeInChunks"
```

---

## Task 4: Reescrever `POST /api/transcribe` com streaming + quota

**Files:**
- Modify: `src/app/api/transcribe/route.ts`
- Modify: `src/app/api/transcribe/route.test.ts`

- [ ] **Step 1: Substituir `src/app/api/transcribe/route.test.ts`**

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetServerUser, mockTranscribeInChunks, mockSaveTranscript } = vi.hoisted(() => ({
  mockGetServerUser: vi.fn(),
  mockTranscribeInChunks: vi.fn(),
  mockSaveTranscript: vi.fn(),
}))

vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => ({
      json: async () => data,
      status: init?.status ?? 200,
    }),
  },
}))

vi.mock('@/server/services/session', () => ({ getServerUser: mockGetServerUser }))

vi.mock('@/lib/transcribe-chunks', () => ({ transcribeInChunks: mockTranscribeInChunks }))

vi.mock('@/server/actions/consultation', () => ({
  saveTranscriptAndIncrementAttempts: mockSaveTranscript,
}))

vi.mock('@/server/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { audio_attempts: 0, plan_id: 'experimental', features: [{ id: 'f5', limit: 2 }] } }),
          }),
        }),
      }),
    }),
  },
}))

vi.mock('groq-sdk', () => ({
  default: class Groq {},
}))

import { POST } from './route'

function makeFormData(file: File | null, patientId = 'patient-1'): Request {
  const fd = new FormData()
  if (file) fd.append('audio', file)
  fd.append('patientId', patientId)
  return { formData: async () => fd } as unknown as Request
}

function makeFile(name: string, sizeMB = 2): File {
  const bytes = new Uint8Array(sizeMB * 1024 * 1024)
  return new File([bytes], name, { type: 'audio/mpeg' })
}

describe('POST /api/transcribe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GROQ_API_KEY = 'test-key'
    mockGetServerUser.mockResolvedValue({ sub: 'user-1' })
    mockTranscribeInChunks.mockImplementation(async (_file, _groq, onChunk) => {
      onChunk?.('texto transcrito')
      return 'texto transcrito'
    })
    mockSaveTranscript.mockResolvedValue(undefined)
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetServerUser.mockResolvedValue(null)
    const res = await POST(makeFormData(makeFile('audio.mp3')) as never)
    expect(res.status).toBe(401)
  })

  it('returns 400 when audio file is missing', async () => {
    const res = await POST(makeFormData(null) as never)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Arquivo de áudio não enviado.')
  })

  it('returns 400 when patientId is missing', async () => {
    const fd = new FormData()
    fd.append('audio', makeFile('audio.mp3'))
    const req = { formData: async () => fd } as unknown as Request
    const res = await POST(req as never)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('patientId não informado.')
  })

  it('returns 503 when GROQ_API_KEY is not set', async () => {
    const original = process.env.GROQ_API_KEY
    delete process.env.GROQ_API_KEY
    try {
      const res = await POST(makeFormData(makeFile('audio.mp3')) as never)
      expect(res.status).toBe(503)
    } finally {
      process.env.GROQ_API_KEY = original
    }
  })

  it('returns streaming Response on success', async () => {
    const res = await POST(makeFormData(makeFile('audio.mp3')) as never)
    expect(res).toBeInstanceOf(Response)
    expect(res.headers.get('Content-Type')).toContain('text/plain')
  })

  it('calls saveTranscriptAndIncrementAttempts after transcription', async () => {
    await POST(makeFormData(makeFile('audio.mp3')) as never)
    expect(mockSaveTranscript).toHaveBeenCalledWith('patient-1', 'texto transcrito')
  })
})
```

- [ ] **Step 2: Rodar testes — confirmar FALHAM (RED)**

```bash
cd "d:\REPOS-GITHUB-PARTICULAR\project-anamnese-ia-claude-code-repo-local" && npm test -- src/app/api/transcribe/route.test.ts 2>&1 | tail -15
```

Esperado: vários failures.

- [ ] **Step 3: Substituir `src/app/api/transcribe/route.ts`**

```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import Groq from 'groq-sdk'
import { getServerUser } from '@/server/services/session'
import { transcribeInChunks } from '@/lib/transcribe-chunks'
import { saveTranscriptAndIncrementAttempts } from '@/server/actions/consultation'
import { supabase } from '@/server/supabase'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY ?? '' })

export async function POST(req: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'Serviço de transcrição indisponível.' }, { status: 503 })
  }

  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('audio') as File | null
  const patientId = formData.get('patientId') as string | null

  if (!file) {
    return NextResponse.json({ error: 'Arquivo de áudio não enviado.' }, { status: 400 })
  }
  if (!patientId) {
    return NextResponse.json({ error: 'patientId não informado.' }, { status: 400 })
  }

  // Check quota
  const { data: consultation } = await supabase
    .from('consultations')
    .select('audio_attempts')
    .eq('user_id', user.sub)
    .eq('patient_id', patientId)
    .single()

  const { data: userData } = await supabase
    .from('users')
    .select('plan_id')
    .eq('id', user.sub)
    .single()

  const planId = (userData?.plan_id as string | null) ?? 'experimental'

  const { data: planData } = await supabase
    .from('plans')
    .select('features')
    .eq('id', planId)
    .single()

  const features = (planData?.features ?? []) as { id: string; limit?: number | null }[]
  const f5 = features.find(f => f.id === 'f5')
  const limit = f5?.limit ?? null
  const used = (consultation?.audio_attempts ?? 0) as number

  if (limit !== null && used >= limit) {
    return NextResponse.json({ error: 'Cota de tentativas esgotada.' }, { status: 403 })
  }

  // Stream transcription
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const transcript = await transcribeInChunks(file, groq, (chunkText) => {
          controller.enqueue(encoder.encode(chunkText + '\n'))
        })
        await saveTranscriptAndIncrementAttempts(patientId, transcript)
        controller.enqueue(encoder.encode('__DONE__\n'))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro na transcrição.'
        controller.enqueue(encoder.encode(`__ERROR__:${message}\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
```

- [ ] **Step 4: Rodar testes da rota — confirmar PASSAM (GREEN)**

```bash
cd "d:\REPOS-GITHUB-PARTICULAR\project-anamnese-ia-claude-code-repo-local" && npm test -- src/app/api/transcribe/route.test.ts 2>&1 | tail -10
```

Esperado: `6 passed`.

- [ ] **Step 5: Rodar suite completa**

```bash
cd "d:\REPOS-GITHUB-PARTICULAR\project-anamnese-ia-claude-code-repo-local" && npm test 2>&1 | tail -10
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/transcribe/route.ts src/app/api/transcribe/route.test.ts
git commit -m "feat: streaming ReadableStream transcription with quota check"
```

---

## Task 5: Atualizar `page.tsx` — buscar dados extras

**Files:**
- Modify: `src/app/(session)/consultation/[id]/page.tsx`

- [ ] **Step 1: Substituir `src/app/(session)/consultation/[id]/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { getServerUser } from '@/server/services/session'
import { PatientRepository } from '@/server/repositories/db'
import { supabase } from '@/server/supabase'
import { ConsultationPageFlow } from './consultation-page-flow'

async function getConsultationPageData(userId: string, patientId: string) {
  const { data: user } = await supabase
    .from('users')
    .select('plan_id')
    .eq('id', userId)
    .single()

  const planId = (user?.plan_id as string | null) ?? 'experimental'

  const { data: plan } = await supabase
    .from('plans')
    .select('features')
    .eq('id', planId)
    .single()

  const features = (plan?.features ?? []) as {
    id: string
    label: string
    active: boolean
    limit?: number | null
  }[]

  const f5 = features.find(f => f.id === 'f5')
  const f6 = features.find(f => f.id === 'f6')

  const { data: consultation } = await supabase
    .from('consultations')
    .select('audio_attempts, raw_transcript')
    .eq('user_id', userId)
    .eq('patient_id', patientId)
    .single()

  return {
    planFeatures: {
      audioAttemptsLabel: f5?.label ?? 'Envios de áudio incluídos',
      refinementsLabel: f6?.label ?? 'Refinamentos de IA incluídos',
    },
    audioAttemptsUsed: (consultation?.audio_attempts ?? 0) as number,
    audioAttemptsLimit: f5?.limit ?? null,
    initialTranscript: (consultation?.raw_transcript ?? '') as string,
  }
}

export default async function ConsultationSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getServerUser()
  if (!user) notFound()

  const [patient, data] = await Promise.all([
    PatientRepository.findById(user.sub, id),
    getConsultationPageData(user.sub, id),
  ])

  if (!patient) notFound()

  return (
    <ConsultationPageFlow
      patient={patient}
      planFeatures={data.planFeatures}
      audioAttemptsUsed={data.audioAttemptsUsed}
      audioAttemptsLimit={data.audioAttemptsLimit}
      initialTranscript={data.initialTranscript}
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(session)/consultation/[id]/page.tsx"
git commit -m "feat: fetch audio attempts, quota limit and initial transcript in session page"
```

---

## Task 6: Atualizar `ConsultationContext` — `initialTranscript`

**Files:**
- Modify: `src/context/consultation-context.tsx`

- [ ] **Step 1: Substituir `src/context/consultation-context.tsx`**

```tsx
'use client'
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import type { ConsultationFlowState, Patient, StructuredAnamnesis, ConsultationStep } from '@/types'

interface ConsultationContextValue {
  state: ConsultationFlowState
  setPatient: (patient: Patient) => void
  setRawTranscript: (transcript: string) => void
  setSelectedSections: (sections: string[]) => void
  setStructuredAnamnesis: (anamnesis: StructuredAnamnesis) => void
  nextStep: () => void
  prevStep: () => void
  reset: () => void
}

const ConsultationContext = createContext<ConsultationContextValue | null>(null)

export function ConsultationProvider({
  children,
  initialPatient,
  initialTranscript,
}: {
  children: ReactNode
  initialPatient?: Patient | null
  initialTranscript?: string
}) {
  const hasTranscript = Boolean(initialTranscript)

  const [state, setState] = useState<ConsultationFlowState>({
    step: hasTranscript ? 4 : 1,
    patient: initialPatient ?? null,
    rawTranscript: initialTranscript ?? '',
    selectedSections: [],
    structuredAnamnesis: null,
  })

  const setPatient = useCallback((patient: Patient) =>
    setState(s => ({ ...s, patient })), [])

  const setRawTranscript = useCallback((rawTranscript: string) =>
    setState(s => ({ ...s, rawTranscript })), [])

  const setSelectedSections = useCallback((selectedSections: string[]) =>
    setState(s => ({ ...s, selectedSections })), [])

  const setStructuredAnamnesis = useCallback((structuredAnamnesis: StructuredAnamnesis) =>
    setState(s => ({ ...s, structuredAnamnesis })), [])

  const nextStep = useCallback(() =>
    setState(s => ({ ...s, step: Math.min(5, s.step + 1) as ConsultationStep })), [])

  const prevStep = useCallback(() =>
    setState(s => ({ ...s, step: Math.max(1, s.step - 1) as ConsultationStep })), [])

  const reset = useCallback(() => setState({
    step: 1,
    patient: null,
    rawTranscript: '',
    selectedSections: [],
    structuredAnamnesis: null,
  }), [])

  return (
    <ConsultationContext.Provider value={{
      state, setPatient, setRawTranscript, setSelectedSections,
      setStructuredAnamnesis, nextStep, prevStep, reset,
    }}>
      {children}
    </ConsultationContext.Provider>
  )
}

export function useConsultationFlow(): ConsultationContextValue {
  const ctx = useContext(ConsultationContext)
  if (!ctx) throw new Error('useConsultationFlow must be used within ConsultationProvider')
  return ctx
}
```

- [ ] **Step 2: Rodar suite — confirmar sem regressões**

```bash
cd "d:\REPOS-GITHUB-PARTICULAR\project-anamnese-ia-claude-code-repo-local" && npm test 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add src/context/consultation-context.tsx
git commit -m "feat: ConsultationProvider accepts initialTranscript, restores to step 4"
```

---

## Task 7: Atualizar `consultation-page-flow.tsx` — passar props ao `StepAudio`

**Files:**
- Modify: `src/app/(session)/consultation/[id]/consultation-page-flow.tsx`

- [ ] **Step 1: Atualizar `consultation-page-flow.tsx`**

Alterar a interface de props para incluir os novos campos e passá-los ao `ConsultationProvider` e `StepAudio`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ConsultationProvider, useConsultationFlow } from '@/context/consultation-context'
import { StepIndicator } from '@/components/steps/step-indicator'
import { StepPatient } from '@/components/steps/step-patient'
import { StepResponsibility } from '@/components/steps/step-responsibility'
import { StepAudio } from '@/components/steps/step-audio'
import { StepSections } from '@/components/steps/step-sections'
import { StepAnamnesis } from '@/components/steps/step-anamnesis'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { debitConsultationCredit, abandonConsultation } from '@/server/actions/consultation'
import { ROUTES } from '@/lib/routes'
import type { Patient } from '@/types'

interface PlanFeatures {
  audioAttemptsLabel: string
  refinementsLabel: string
}

interface ConsultationPageFlowProps {
  patient: Patient
  planFeatures: PlanFeatures
  audioAttemptsUsed: number
  audioAttemptsLimit: number | null
  initialTranscript: string
}

function AtendimentoFlow({
  patient,
  planFeatures,
  audioAttemptsUsed,
  audioAttemptsLimit,
  initialTranscript,
}: ConsultationPageFlowProps) {
  const { state } = useConsultationFlow()
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [creditDebited, setCreditDebited] = useState(false)
  const [attemptsUsed, setAttemptsUsed] = useState(audioAttemptsUsed)

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  function handleComplete(consultationId: string) {
    router.push(ROUTES.resultado(consultationId))
  }

  async function handleDebit(): Promise<{ error?: string }> {
    const result = await debitConsultationCredit(patient.id)
    if (!result.error) {
      setCreditDebited(true)
      toast.success('1 crédito debitado. Atendimento iniciado.')
    } else {
      toast.error(result.error)
    }
    return result
  }

  function handleTranscriptionComplete() {
    setAttemptsUsed(prev => prev + 1)
  }

  const aiWasUsed = state.rawTranscript !== '' || state.structuredAnamnesis !== null

  function handleAbandonClick() {
    setConfirmOpen(true)
  }

  function handleAbandonConfirmed() {
    const refund = creditDebited && !aiWasUsed

    toast.promise(
      abandonConsultation(patient.id, state.step, state.rawTranscript, aiWasUsed).then(() => {
        router.push(ROUTES.atendimento)
      }),
      {
        loading: 'Aguarde...',
        success: refund
          ? '1 crédito devolvido. Consulta encerrada.'
          : 'Consulta encerrada.',
        error: 'Erro ao encerrar. Tente novamente.',
      }
    )
  }

  const abandonTitle = creditDebited && !aiWasUsed
    ? 'Crédito será devolvido'
    : creditDebited
      ? 'Crédito não será devolvido'
      : 'Abandonar consulta?'

  const abandonDescription = creditDebited && !aiWasUsed
    ? 'Nenhum processamento de IA foi utilizado. O crédito debitado será devolvido ao seu saldo.'
    : creditDebited
      ? 'Processamento de IA já foi utilizado nesta sessão. O crédito não poderá ser devolvido.'
      : 'Tem certeza que deseja encerrar esta consulta? O paciente selecionado não será alterado.'

  return (
    <>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{abandonTitle}</AlertDialogTitle>
            <AlertDialogDescription>{abandonDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar consulta</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleAbandonConfirmed}
            >
              Abandonar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">Atendimento</h1>
            <p className="text-sm text-muted-foreground">{patient.name}</p>
          </div>
          {state.step < 5 && (
            <Button
              size="lg"
              className="shrink-0 bg-red-600 hover:bg-red-700 text-white"
              onClick={handleAbandonClick}
            >
              Abandonar consulta
            </Button>
          )}
        </div>

        <StepIndicator currentStep={state.step} />

        <Card>
          <CardContent className="pt-4">
            {state.step === 1 && (
              <StepPatient
                audioAttemptsLabel={planFeatures.audioAttemptsLabel}
                refinementsLabel={planFeatures.refinementsLabel}
                onDebit={handleDebit}
              />
            )}
            {state.step === 2 && <StepResponsibility />}
            {state.step === 3 && (
              <StepAudio
                patientId={patient.id}
                audioAttemptsUsed={attemptsUsed}
                audioAttemptsLimit={audioAttemptsLimit}
                initialTranscript={initialTranscript}
                onTranscriptionComplete={handleTranscriptionComplete}
              />
            )}
            {state.step === 4 && <StepSections />}
            {state.step === 5 && (
              <StepAnamnesis patientId={patient.id} onComplete={handleComplete} />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

export function ConsultationPageFlow({
  patient,
  planFeatures,
  audioAttemptsUsed,
  audioAttemptsLimit,
  initialTranscript,
}: ConsultationPageFlowProps) {
  return (
    <ConsultationProvider initialPatient={patient} initialTranscript={initialTranscript}>
      <AtendimentoFlow
        patient={patient}
        planFeatures={planFeatures}
        audioAttemptsUsed={audioAttemptsUsed}
        audioAttemptsLimit={audioAttemptsLimit}
        initialTranscript={initialTranscript}
      />
    </ConsultationProvider>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(session)/consultation/[id]/consultation-page-flow.tsx"
git commit -m "feat: pass audio quota and initial transcript props through consultation flow"
```

---

## Task 8: Redesign completo do `StepAudio`

**Files:**
- Modify: `src/components/steps/step-audio.tsx`

- [ ] **Step 1: Substituir `src/components/steps/step-audio.tsx`**

```tsx
'use client'
import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useConsultationFlow } from '@/context/consultation-context'
import { toast } from 'sonner'

const ACCEPTED_FORMATS = '.mp3,.wav,.m4a,.ogg'

type AudioState = 'idle' | 'streaming' | 'done' | 'quota_exceeded'

interface StepAudioProps {
  patientId: string
  audioAttemptsUsed: number
  audioAttemptsLimit: number | null  // null = ilimitado
  initialTranscript: string
  onTranscriptionComplete: () => void
}

export function StepAudio({
  patientId,
  audioAttemptsUsed,
  audioAttemptsLimit,
  initialTranscript,
  onTranscriptionComplete,
}: StepAudioProps) {
  const { nextStep, setRawTranscript } = useConsultationFlow()

  const quotaExceeded = audioAttemptsLimit !== null && audioAttemptsUsed >= audioAttemptsLimit

  const [audioState, setAudioState] = useState<AudioState>(
    initialTranscript ? 'done' : quotaExceeded ? 'quota_exceeded' : 'idle'
  )
  const [file, setFile] = useState<File | null>(null)
  const [partialTranscript, setPartialTranscript] = useState(initialTranscript)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (initialTranscript) {
      setRawTranscript(initialTranscript)
    }
  }, [initialTranscript, setRawTranscript])

  function handleFile(selected: File) {
    setFile(selected)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const dropped = e.dataTransfer.files[0]
    if (dropped) handleFile(dropped)
  }

  function handleReset() {
    setFile(null)
    setPartialTranscript('')
    setAudioState('idle')
  }

  async function handleProcess() {
    if (!file) return
    setAudioState('streaming')

    const formData = new FormData()
    formData.append('audio', file)
    formData.append('patientId', patientId)

    let toastId: string | number | undefined
    toastId = toast.loading('Aguarde...')

    try {
      const response = await fetch('/api/transcribe', { method: 'POST', body: formData })

      if (!response.ok) {
        const data = await response.json() as { error?: string }
        throw new Error(data.error ?? 'Erro na transcrição.')
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        if (text.includes('__ERROR__:')) {
          const msg = text.replace('__ERROR__:', '').replace('__DONE__', '').trim()
          throw new Error(msg)
        }
        const clean = text.replace('__DONE__', '').replace(/\n$/, '')
        if (clean) {
          full += (full ? ' ' : '') + clean
          setPartialTranscript(full)
        }
        if (text.includes('__DONE__')) break
      }

      setRawTranscript(full)
      onTranscriptionComplete()
      setAudioState('done')
      toast.dismiss(toastId)
      toast.success('Transcrição concluída!')
    } catch (err) {
      toast.dismiss(toastId)
      toast.error(err instanceof Error ? err.message : 'Erro inesperado.')
      setAudioState('idle')
    }
  }

  const canRetry = audioAttemptsLimit === null || audioAttemptsUsed < audioAttemptsLimit

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Enviar Áudio da Consulta</h2>
        {audioAttemptsLimit !== null && (
          <div className="text-right">
            <p className="text-sm font-medium">
              Uso da cota: {audioAttemptsUsed}/{audioAttemptsLimit}
            </p>
            <p className="text-xs text-muted-foreground">
              Você possui {audioAttemptsLimit} tentativa{audioAttemptsLimit !== 1 ? 's' : ''} inclusas.
            </p>
          </div>
        )}
      </div>

      {audioState === 'quota_exceeded' && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Você utilizou todas as {audioAttemptsLimit} tentativas de envio disponíveis no seu plano.
          </p>
          {partialTranscript && (
            <Button className="mt-3" onClick={nextStep}>
              Continuar com última transcrição
            </Button>
          )}
        </div>
      )}

      {audioState === 'idle' && (
        <>
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            className="cursor-pointer rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary hover:bg-secondary hover:text-foreground"
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_FORMATS}
              className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            {file ? (
              <div className="space-y-1">
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                <p className="text-xs text-primary">Clique para trocar o arquivo</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-muted-foreground">Arraste o arquivo aqui ou clique para selecionar</p>
                <p className="text-sm text-muted-foreground">Formatos: MP3, WAV, M4A, OGG</p>
              </div>
            )}
          </div>
          <Button onClick={handleProcess} disabled={!file}>
            Iniciar Processamento
          </Button>
        </>
      )}

      {(audioState === 'streaming' || audioState === 'done') && (
        <div className="space-y-3">
          <Textarea
            readOnly
            value={partialTranscript}
            rows={10}
            className="resize-none font-mono text-sm"
            placeholder="Transcrição aparecerá aqui..."
          />
          {audioState === 'streaming' && (
            <p className="text-xs text-muted-foreground animate-pulse">Processando áudio...</p>
          )}
          {audioState === 'done' && (
            <div className="flex gap-2">
              <Button onClick={nextStep}>Continuar</Button>
              {canRetry && (
                <Button variant="outline" onClick={handleReset}>
                  Trocar áudio
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Rodar suite — confirmar sem erros de compilação**

```bash
cd "d:\REPOS-GITHUB-PARTICULAR\project-anamnese-ia-claude-code-repo-local" && npm test 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add src/components/steps/step-audio.tsx
git commit -m "feat: StepAudio with live streaming, quota display and retry button"
```

---

## Task 9: `use-consultation` — limpar transcript após salvar

**Files:**
- Modify: `src/hooks/use-consultation.ts`

- [ ] **Step 1: Atualizar `src/hooks/use-consultation.ts`**

```ts
'use client'
import { useCallback } from 'react'
import { generateId } from '@/lib/utils'
import { API } from '@/lib/routes'
import { clearTranscript } from '@/server/actions/consultation'
import type { Consultation, StructuredAnamnesis } from '@/types'

export function useConsultation(patientId: string) {
  const saveConsultation = useCallback(async (
    rawTranscript: string,
    structuredAnamnesis: StructuredAnamnesis,
  ): Promise<Consultation> => {
    const now = new Date().toISOString()
    const consultation: Consultation = {
      id: generateId(),
      patientId,
      rawTranscript,
      structuredAnamnesis,
      createdAt: now,
      updatedAt: now,
    }
    await fetch(API.consultations, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(consultation),
    })
    // Clear raw_transcript from DB for privacy after saving the structured anamnesis
    await clearTranscript(patientId)
    return consultation
  }, [patientId])

  return { saveConsultation }
}
```

- [ ] **Step 2: Rodar suite completa**

```bash
cd "d:\REPOS-GITHUB-PARTICULAR\project-anamnese-ia-claude-code-repo-local" && npm test 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-consultation.ts
git commit -m "feat: clear raw_transcript after saving consultation for privacy"
```
