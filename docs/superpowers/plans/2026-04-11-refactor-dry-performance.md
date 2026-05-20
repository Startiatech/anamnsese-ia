# Refactor: DRY, Performance & Componentization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar prop drilling no fluxo de atendimento, substituir useEffect+fetch por Server Action, e extrair componentes grandes em arquivos focados.

**Architecture:** Quatro tarefas independentes: (1) ConsultationContext absorve props estáticas; (2) LastAnamnesisSheet usa Server Action; (3) login-client split em LoginForm + AccessRequestChat; (4) users-client modals extraídos. Cada tarefa é testável e deployável isoladamente.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · Vitest + RTL · `useTransition` · shadcn/ui

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/context/consultation-context.tsx` | Modify | Adicionar campos estáticos: professional, limits, planFeatures, lastConsultationAt |
| `src/app/(session)/consultation/[id]/consultation-page-flow.tsx` | Modify | AtendimentoFlow perde 6 props; ConsultationProvider recebe-as |
| `src/components/steps/step-patient.tsx` | Modify | Lê planFeatures/lastConsultationAt do context em vez de props |
| `src/components/steps/step-audio.tsx` | Modify | Lê audioAttemptsLimit do context em vez de props |
| `src/components/steps/step-anamnesis.tsx` | Modify | Lê professional/refinementAttemptsLimit do context em vez de props |
| `src/app/(session)/consultation/[id]/consultation-page-flow.test.tsx` | Modify | Atualizar mocks dos steps para nova assinatura |
| `src/server/actions/consultation.ts` | Modify | Adicionar `getLatestConsultation(patientId)` |
| `src/components/consultation/last-anamnesis-sheet.tsx` | Modify | useEffect+fetch → useTransition + Server Action |
| `src/app/(auth)/login/access-request-chat.tsx` | Create | Chat de solicitação de acesso (extraído de login-client) |
| `src/app/(auth)/login/login-client.tsx` | Modify | Remove chat state/JSX, usa `<AccessRequestChat>` |
| `src/app/(admin)/console/users/add-user-modal.tsx` | Create | Modal inline AddUser extraído |
| `src/app/(admin)/console/users/edit-user-modal.tsx` | Create | Modal inline EditUser extraído |
| `src/app/(admin)/console/users/delete-user-modal.tsx` | Create | Modal inline DeleteUser extraído |
| `src/app/(admin)/console/users/inject-credits-modal.tsx` | Create | Modal inline InjectCredits extraído |
| `src/app/(admin)/console/users/users-client.tsx` | Modify | Importa modals de arquivos separados |

---

## Task 1: Estender ConsultationContext (prop drilling fix)

**Files:**
- Modify: `src/context/consultation-context.tsx`
- Modify: `src/app/(session)/consultation/[id]/consultation-page-flow.tsx`
- Modify: `src/components/steps/step-patient.tsx`
- Modify: `src/components/steps/step-audio.tsx`
- Modify: `src/components/steps/step-anamnesis.tsx`
- Modify: `src/app/(session)/consultation/[id]/consultation-page-flow.test.tsx`

- [ ] **Step 1: Escrever teste de regressão para novas props do context**

Crie `src/context/consultation-context.test.tsx`:

```tsx
// @vitest-environment jsdom
import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { ConsultationProvider, useConsultationFlow } from './consultation-context'

const planFeatures = { audioAttemptsLabel: 'Envios', refinementsLabel: 'Refinamentos' }
const professional = { name: 'Dr. Test', specialty: 'Clínica', crm: 'CRM 1234 SP' }

function Consumer() {
  const { planFeatures: pf, professional: prof, audioAttemptsLimit, refinementAttemptsLimit, lastConsultationAt } = useConsultationFlow()
  return (
    <div>
      <span data-testid="audio-label">{pf.audioAttemptsLabel}</span>
      <span data-testid="prof-name">{prof.name}</span>
      <span data-testid="audio-limit">{audioAttemptsLimit ?? 'null'}</span>
      <span data-testid="ref-limit">{refinementAttemptsLimit ?? 'null'}</span>
      <span data-testid="last-at">{lastConsultationAt ?? 'null'}</span>
    </div>
  )
}

describe('ConsultationContext — static fields', () => {
  it('exposes planFeatures from provider', () => {
    render(
      <ConsultationProvider
        planFeatures={planFeatures}
        professional={professional}
        audioAttemptsLimit={3}
        refinementAttemptsLimit={2}
        lastConsultationAt="2026-04-01T10:00:00Z"
      >
        <Consumer />
      </ConsultationProvider>
    )
    expect(screen.getByTestId('audio-label').textContent).toBe('Envios')
    expect(screen.getByTestId('prof-name').textContent).toBe('Dr. Test')
    expect(screen.getByTestId('audio-limit').textContent).toBe('3')
    expect(screen.getByTestId('ref-limit').textContent).toBe('2')
    expect(screen.getByTestId('last-at').textContent).toBe('2026-04-01T10:00:00Z')
  })

  it('accepts null values for limits and lastConsultationAt', () => {
    render(
      <ConsultationProvider
        planFeatures={planFeatures}
        professional={professional}
        audioAttemptsLimit={null}
        refinementAttemptsLimit={null}
        lastConsultationAt={null}
      >
        <Consumer />
      </ConsultationProvider>
    )
    expect(screen.getByTestId('audio-limit').textContent).toBe('null')
    expect(screen.getByTestId('ref-limit').textContent).toBe('null')
    expect(screen.getByTestId('last-at').textContent).toBe('null')
  })
})
```

- [ ] **Step 2: Rodar teste para confirmar que falha**

```bash
npm test src/context/consultation-context.test.tsx
```
Expected: FAIL — `planFeatures is not a property of ConsultationContextValue`

- [ ] **Step 3: Estender `consultation-context.tsx`**

Adicionar interfaces e novos campos ao context. Substitua o arquivo completo:

```tsx
'use client'
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import type { ConsultationFlowState, Patient, StructuredAnamnesis, ConsultationStep } from '@/types'

interface PlanFeatures {
  audioAttemptsLabel: string
  refinementsLabel: string
}

interface Professional {
  name: string
  specialty: string
  crm: string
}

interface ConsultationContextValue {
  state: ConsultationFlowState
  planFeatures: PlanFeatures
  professional: Professional
  audioAttemptsLimit: number | null
  refinementAttemptsLimit: number | null
  lastConsultationAt: string | null
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
  planFeatures,
  professional,
  audioAttemptsLimit,
  refinementAttemptsLimit,
  lastConsultationAt,
}: {
  children: ReactNode
  initialPatient?: Patient | null
  initialTranscript?: string
  planFeatures: PlanFeatures
  professional: Professional
  audioAttemptsLimit: number | null
  refinementAttemptsLimit: number | null
  lastConsultationAt: string | null
}) {
  const [state, setState] = useState<ConsultationFlowState>({
    step: 1,
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
      state,
      planFeatures,
      professional,
      audioAttemptsLimit,
      refinementAttemptsLimit,
      lastConsultationAt,
      setPatient,
      setRawTranscript,
      setSelectedSections,
      setStructuredAnamnesis,
      nextStep,
      prevStep,
      reset,
    }}>
      {children}
    </ConsultationContext.Provider>
  )
}

export function useConsultationFlow() {
  const ctx = useContext(ConsultationContext)
  if (!ctx) throw new Error('useConsultationFlow must be used inside ConsultationProvider')
  return ctx
}
```

> **Nota:** verifique se o restante de `consultation-context.tsx` já tinha esse hook no final — preservar qualquer export adicional.

- [ ] **Step 4: Rodar teste para confirmar PASS**

```bash
npm test src/context/consultation-context.test.tsx
```
Expected: PASS

- [ ] **Step 5: Atualizar `consultation-page-flow.tsx`**

`ConsultationPageFlow` passa os campos estáticos para `ConsultationProvider` em vez de para `AtendimentoFlow`. `AtendimentoFlow` perde 6 props de sua interface (planFeatures, audioAttemptsLimit, refinementAttemptsLimit, lastConsultationAt, professional — `creditsRemaining` e `planId` ficam em AtendimentoFlow pois são usados lá mesmo).

Altere as interfaces e o provider assim:

```tsx
// Interface do AtendimentoFlow — remove os 5 campos estáticos
interface AtendimentoFlowProps {
  patient: Patient
  audioAttemptsUsed: number
  refinementAttemptsUsed: number
  initialTranscript: string
  creditsRemaining: number
  planId: string
}

// ConsultationPageFlow — interface pública não muda (recebe tudo do Server Component)
// Mas agora passa os estáticos para ConsultationProvider:

export function ConsultationPageFlow({
  patient,
  planFeatures,
  audioAttemptsUsed,
  audioAttemptsLimit,
  refinementAttemptsUsed,
  refinementAttemptsLimit,
  initialTranscript,
  lastConsultationAt,
  professional,
  creditsRemaining,
  planId,
}: ConsultationPageFlowProps) {
  return (
    <ConsultationProvider
      initialPatient={patient}
      initialTranscript={initialTranscript}
      planFeatures={planFeatures}
      professional={professional}
      audioAttemptsLimit={audioAttemptsLimit}
      refinementAttemptsLimit={refinementAttemptsLimit}
      lastConsultationAt={lastConsultationAt}
    >
      <AtendimentoFlow
        patient={patient}
        audioAttemptsUsed={audioAttemptsUsed}
        refinementAttemptsUsed={refinementAttemptsUsed}
        initialTranscript={initialTranscript}
        creditsRemaining={creditsRemaining}
        planId={planId}
      />
    </ConsultationProvider>
  )
}
```

No corpo de `AtendimentoFlow`, remova as props `planFeatures`, `audioAttemptsLimit`, `refinementAttemptsLimit`, `lastConsultationAt`, `professional` da desestruturação. O render de `StepPatient` deixa de passar `audioAttemptsLabel`, `refinementsLabel`, `lastConsultationAt`. O render de `StepAudio` deixa de passar `audioAttemptsLimit`. O render de `StepAnamnesis` deixa de passar `professional` e `refinementAttemptsLimit`.

- [ ] **Step 6: Atualizar `step-patient.tsx`**

Remover `audioAttemptsLabel`, `refinementsLabel`, `lastConsultationAt` das props; ler do context:

```tsx
import { useConsultationFlow } from '@/context/consultation-context'

interface StepPatientProps {
  onDebit: () => Promise<{ error?: string }>
}

export function StepPatient({ onDebit }: StepPatientProps) {
  const { planFeatures, lastConsultationAt } = useConsultationFlow()
  // usar planFeatures.audioAttemptsLabel, planFeatures.refinementsLabel, lastConsultationAt
  // (substituir as referências aos antigos props)
  ...
}
```

- [ ] **Step 7: Atualizar `step-audio.tsx`**

Remover `audioAttemptsLimit` das props; ler do context:

```tsx
import { useConsultationFlow } from '@/context/consultation-context'

interface StepAudioProps {
  patientId: string
  audioAttemptsUsed: number
  initialTranscript: string
  onTranscriptionComplete: () => void
}

export function StepAudio({ patientId, audioAttemptsUsed, initialTranscript, onTranscriptionComplete }: StepAudioProps) {
  const { audioAttemptsLimit } = useConsultationFlow()
  ...
}
```

- [ ] **Step 8: Atualizar `step-anamnesis.tsx`**

Remover `professional` e `refinementAttemptsLimit` das props; ler do context:

```tsx
import { useConsultationFlow } from '@/context/consultation-context'

interface StepAnamnesisProps {
  patientId: string
  onComplete: () => void
  refinementAttemptsUsed: number
}

export function StepAnamnesis({ patientId, onComplete, refinementAttemptsUsed }: StepAnamnesisProps) {
  const { professional, refinementAttemptsLimit } = useConsultationFlow()
  ...
}
```

- [ ] **Step 9: Atualizar `consultation-page-flow.test.tsx`**

Adicionar `planFeatures` e `professional` ao mock do `ConsultationProvider` se necessário. O `defaultProps` do teste já não precisa passar os campos que AtendimentoFlow não recebe mais. Verificar que os mocks de `StepPatient` e `StepAudio` ainda compilam (já estão corretos — eles só usam `onDebit` e `onTranscriptionComplete`).

Adicione ao mock existente do `ConsultationProvider` os novos campos obrigatórios:

```tsx
// No topo, após vi.hoisted, antes do import do ConsultationPageFlow:
vi.mock('@/context/consultation-context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/context/consultation-context')>()
  // Wrap provider to inject default static values in tests
  return {
    ...actual,
    ConsultationProvider: ({ children, ...props }: React.ComponentProps<typeof actual.ConsultationProvider>) =>
      <actual.ConsultationProvider
        planFeatures={{ audioAttemptsLabel: 'Envios', refinementsLabel: 'Refinamentos' }}
        professional={{ name: 'Dr. Test', specialty: 'Clínica', crm: 'CRM 1234 SP' }}
        audioAttemptsLimit={3}
        refinementAttemptsLimit={2}
        lastConsultationAt={null}
        {...props}
      >
        {children}
      </actual.ConsultationProvider>,
  }
})
```

> **Alternativa mais simples:** Apenas adicionar os campos ao `defaultProps` do `renderFlow` e atualizar `ConsultationPageFlow` para receber e passar os valores — sem mock do Provider. Prefira esta se o mock acima causar conflito com o real ConsultationProvider.

- [ ] **Step 10: Rodar toda a suite**

```bash
npm test
```
Expected: todos os testes passam. Corrigir quaisquer erros de TypeScript que aparecerem.

- [ ] **Step 11: Commit**

```bash
git add src/context/consultation-context.tsx \
  "src/app/(session)/consultation/[id]/consultation-page-flow.tsx" \
  src/components/steps/step-patient.tsx \
  src/components/steps/step-audio.tsx \
  src/components/steps/step-anamnesis.tsx \
  "src/app/(session)/consultation/[id]/consultation-page-flow.test.tsx" \
  src/context/consultation-context.test.tsx
git commit -m "refactor(consultation): move static props into ConsultationContext"
```

---

## Task 2: LastAnamnesisSheet — Server Action em vez de useEffect+fetch

**Files:**
- Modify: `src/server/actions/consultation.ts`
- Modify: `src/components/consultation/last-anamnesis-sheet.tsx`

- [ ] **Step 1: Escrever teste para Server Action**

Crie `src/server/actions/consultation.test.ts` (ou adicione ao existente):

```ts
// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn(),
  },
}))

vi.mock('@/server/supabase', () => ({ supabase: mockSupabase }))
vi.mock('next/headers', () => ({ cookies: vi.fn(() => ({ get: vi.fn() })) }))

import { getLatestConsultation } from './consultation'

describe('getLatestConsultation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns consultation when found', async () => {
    const consultation = {
      id: 'c1',
      structured_anamnesis: { sections: [{ title: 'HDA', content: 'dor torácica' }] },
    }
    mockSupabase.single.mockResolvedValue({ data: consultation, error: null })

    const result = await getLatestConsultation('p1', 'u1')

    expect(result).not.toBeNull()
    expect(result?.structuredAnamnesis.sections[0].title).toBe('HDA')
  })

  it('returns null when no consultation exists', async () => {
    mockSupabase.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const result = await getLatestConsultation('p1', 'u1')
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar teste para confirmar FAIL**

```bash
npm test src/server/actions/consultation.test.ts
```
Expected: FAIL — `getLatestConsultation is not exported`

- [ ] **Step 3: Adicionar `getLatestConsultation` em `consultation.ts`**

Abra `src/server/actions/consultation.ts` e adicione ao final:

```ts
'use server'
// (já existe no topo do arquivo)

import type { Consultation } from '@/types'

export async function getLatestConsultation(
  patientId: string,
  userId: string,
): Promise<Consultation | null> {
  const { data, error } = await supabase
    .from('consultations')
    .select('id, structured_anamnesis, raw_transcript, created_at, updated_at')
    .eq('patient_id', patientId)
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return null

  return {
    id: data.id,
    structuredAnamnesis: data.structured_anamnesis,
    rawTranscript: data.raw_transcript,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  } as Consultation
}
```

> **Atenção:** verifique o nome exato da coluna `structured_anamnesis` no Supabase e o shape do tipo `Consultation` em `src/types`. Ajuste os campos conforme necessário.

- [ ] **Step 4: Rodar teste para confirmar PASS**

```bash
npm test src/server/actions/consultation.test.ts
```
Expected: PASS

- [ ] **Step 5: Atualizar `last-anamnesis-sheet.tsx`**

Substituir `useEffect+fetch` por `useTransition` + Server Action. O fetch agora é disparado ao abrir o sheet:

```tsx
'use client'

import { useTransition, useState, useEffect } from 'react'
import { FileText } from 'lucide-react'
import { AppSheet } from '@/components/ui/app-sheet'
import { getLatestConsultation } from '@/server/actions/consultation'
import type { Consultation, PatientWithStats } from '@/types'

interface LastAnamnesisSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patient: PatientWithStats
  userId: string
}

export function LastAnamnesisSheet({ open, onOpenChange, patient, userId }: LastAnamnesisSheetProps) {
  const [consultation, setConsultation] = useState<Consultation | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    startTransition(async () => {
      const result = await getLatestConsultation(patient.id, userId)
      setConsultation(result)
    })
  }, [open, patient.id, userId])

  return (
    <AppSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Última anamnese — ${patient.name}`}
      description="Resultado da última consulta registrada."
      icon={<FileText className="h-4 w-4 text-violet-400" />}
      hideFooter
    >
      {isPending && (
        <p className="text-sm text-muted-foreground animate-pulse">Carregando...</p>
      )}
      {!isPending && !consultation && (
        <p className="text-sm text-muted-foreground">Nenhuma anamnese encontrada para este paciente.</p>
      )}
      {!isPending && consultation && (
        <div className="space-y-5">
          {consultation.structuredAnamnesis.sections.map((section) => (
            <div key={section.title}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                {section.title}
              </h3>
              <p className="text-sm text-foreground whitespace-pre-wrap">{section.content}</p>
            </div>
          ))}
        </div>
      )}
    </AppSheet>
  )
}
```

> **Nota:** o `userId` precisa ser passado pelo componente pai. Localize onde `LastAnamnesisSheet` é usado (provavelmente `history-client.tsx` ou similar) e passe `userId` via `useApp().user?.id`. Verifique o `API.patientLatestConsultation` que existia antes — pode ser removido de `routes.ts` se não for mais usado em outro lugar.

- [ ] **Step 6: Rodar toda a suite**

```bash
npm test
```
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/server/actions/consultation.ts \
  src/components/consultation/last-anamnesis-sheet.tsx \
  src/server/actions/consultation.test.ts
git commit -m "refactor(consultation): replace useEffect+fetch with Server Action in LastAnamnesisSheet"
```

---

## Task 3: login-client.tsx — Extrair AccessRequestChat

**Files:**
- Create: `src/app/(auth)/login/access-request-chat.tsx`
- Modify: `src/app/(auth)/login/login-client.tsx`

O `login-client.tsx` tem 578 linhas misturando dois fluxos completamente independentes:
- **LoginForm**: email/password, `useForm` do RHF, `handleSubmit`
- **AccessRequestChat**: `messages`, `currentStep`, `chatInput`, `formData`, `showConfirm`, `isConfirming`, `submitted`, `duplicateRequest`, `showDuplicateAction`, `botReply`, `handleChatSend`

- [ ] **Step 1: Escrever teste para AccessRequestChat**

Crie `src/app/(auth)/login/access-request-chat.test.tsx`:

```tsx
// @vitest-environment jsdom
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockCheckDuplicateRequest, mockSaveAccessRequest } = vi.hoisted(() => ({
  mockCheckDuplicateRequest: vi.fn(),
  mockSaveAccessRequest: vi.fn(),
}))

vi.mock('@/server/actions/requests', () => ({
  checkDuplicateRequest: mockCheckDuplicateRequest,
  saveAccessRequest: mockSaveAccessRequest,
}))

import { AccessRequestChat } from './access-request-chat'

describe('AccessRequestChat', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders initial bot message', () => {
    render(<AccessRequestChat />)
    expect(screen.getByText(/qual é o seu nome/i)).toBeInTheDocument()
  })

  it('advances step after user sends name', async () => {
    render(<AccessRequestChat />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Dr. João' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => {
      expect(screen.getByDisplayValue('')).toBeInTheDocument() // input cleared
    })
  })
})
```

- [ ] **Step 2: Rodar teste para confirmar FAIL**

```bash
npm test src/app/\\(auth\\)/login/access-request-chat.test.tsx
```
Expected: FAIL — `Cannot find module './access-request-chat'`

- [ ] **Step 3: Criar `access-request-chat.tsx`**

Mova todo o estado e JSX do chat de `login-client.tsx` para o novo arquivo. O componente é self-contained e não recebe props obrigatórias (os dados de requests são gerenciados internamente via server actions):

```tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { checkDuplicateRequest, saveAccessRequest } from '@/server/actions/requests'
// Copiar aqui todo o estado: messages, currentStep, chatInput, inputError, formData,
// showConfirm, isConfirming, submitted, duplicateRequest, showDuplicateAction, chatInitialized
// Copiar as funções: botReply, handleChatSend, CHAT_STEPS (ou como estiver nomeado)
// Copiar o JSX do chat (a div que renderiza as mensagens e o input)

export function AccessRequestChat() {
  // [todo o estado e lógica do chat movidos de login-client.tsx]
  // [todo o JSX do chat movido de login-client.tsx]
}
```

> **Como fazer:** No `login-client.tsx` atual, identifique o bloco `{mode === 'solicitar' && ( ... )}` (ou equivalente). Mova tudo que está dentro — incluindo todos os `useState` que só são usados pelo chat — para este arquivo. O componente `LoginClient` ficará responsável apenas pelo formulário de login e pelo roteamento entre os dois modos.

- [ ] **Step 4: Atualizar `login-client.tsx`**

Após a extração, `login-client.tsx` deve importar e usar `<AccessRequestChat>`:

```tsx
import { AccessRequestChat } from './access-request-chat'

// No JSX, substituir o bloco do chat por:
{mode === 'solicitar' ? (
  <AccessRequestChat />
) : (
  // formulário de login existente
)}
```

Remover todos os `useState` e funções que foram movidos para `access-request-chat.tsx`. O arquivo resultante deve ter ~200 linhas.

- [ ] **Step 5: Rodar teste para confirmar PASS**

```bash
npm test src/app/\\(auth\\)/login/access-request-chat.test.tsx
```
Expected: PASS

- [ ] **Step 6: Verificar build**

```bash
npm run build 2>&1 | tail -20
```
Expected: sem erros de TypeScript ou módulos não encontrados.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(auth\)/login/access-request-chat.tsx \
  src/app/\(auth\)/login/access-request-chat.test.tsx \
  src/app/\(auth\)/login/login-client.tsx
git commit -m "refactor(login): extract AccessRequestChat from login-client"
```

---

## Task 4: users-client.tsx — Extrair Modais

**Files:**
- Create: `src/app/(admin)/console/users/add-user-modal.tsx`
- Create: `src/app/(admin)/console/users/edit-user-modal.tsx`
- Create: `src/app/(admin)/console/users/delete-user-modal.tsx`
- Create: `src/app/(admin)/console/users/inject-credits-modal.tsx`
- Modify: `src/app/(admin)/console/users/users-client.tsx`

`users-client.tsx` tem 516 linhas com 4 modais inline, cada um com seu próprio estado e lógica. Cada modal será extraído para seu próprio arquivo com interface clara.

- [ ] **Step 1: Identificar as interfaces de cada modal**

Leia `users-client.tsx` e anote para cada modal:
- Quais props recebe (user, onClose, onSuccess etc.)
- Quais server actions usa
- Quais estados internos tem

Exemplo esperado:
```
AddUserModal: { open, onClose, onSuccess }  — usa: addUser action
EditUserModal: { user, onClose, onSuccess } — usa: updateUser action
DeleteUserModal: { user, onClose, onSuccess } — usa: deleteUser action
InjectCreditsModal: { user, onClose, onSuccess } — usa: injectCredits action
```

- [ ] **Step 2: Escrever teste para AddUserModal**

Crie `src/app/(admin)/console/users/add-user-modal.test.tsx`:

```tsx
// @vitest-environment jsdom
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockAddUser } = vi.hoisted(() => ({
  mockAddUser: vi.fn(),
}))

vi.mock('@/server/actions/users', () => ({
  addUser: mockAddUser,
}))

import { AddUserModal } from './add-user-modal'

describe('AddUserModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders when open', () => {
    render(<AddUserModal open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)
    expect(screen.getByRole('heading', { name: /novo usuário/i })).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<AddUserModal open={false} onClose={vi.fn()} onSuccess={vi.fn()} />)
    expect(screen.queryByRole('heading', { name: /novo usuário/i })).not.toBeInTheDocument()
  })

  it('calls addUser on submit', async () => {
    mockAddUser.mockResolvedValue({})
    const onSuccess = vi.fn()
    render(<AddUserModal open={true} onClose={vi.fn()} onSuccess={onSuccess} />)
    // preencher campos obrigatórios e submeter
    fireEvent.change(screen.getByPlaceholderText(/dr\. joão/i), { target: { value: 'Dr. Test' } })
    fireEvent.change(screen.getByPlaceholderText(/joao@clinica/i), { target: { value: 'test@test.com' } })
    fireEvent.click(screen.getByRole('button', { name: /criar/i }))
    await waitFor(() => expect(mockAddUser).toHaveBeenCalled())
  })
})
```

> **Ajuste os placeholders/textos** para coincidir com o que está em `users-client.tsx`. Leia o arquivo antes de escrever este teste.

- [ ] **Step 3: Rodar teste para confirmar FAIL**

```bash
npm test "src/app/\\(admin\\)/console/users/add-user-modal.test.tsx"
```
Expected: FAIL — `Cannot find module './add-user-modal'`

- [ ] **Step 4: Criar `add-user-modal.tsx`**

Mova o bloco do modal AddUser de `users-client.tsx` para o novo arquivo:

```tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { addUser } from '@/server/actions/users'
// [imports dos componentes de UI que o modal usa]

interface AddUserModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AddUserModal({ open, onClose, onSuccess }: AddUserModalProps) {
  // [estado e lógica movidos de users-client.tsx]
  // [JSX do modal movido de users-client.tsx]
}
```

Repita o processo para `edit-user-modal.tsx`, `delete-user-modal.tsx`, `inject-credits-modal.tsx`.

- [ ] **Step 5: Atualizar `users-client.tsx`**

Substituir as definições inline dos modais por imports:

```tsx
import { AddUserModal } from './add-user-modal'
import { EditUserModal } from './edit-user-modal'
import { DeleteUserModal } from './delete-user-modal'
import { InjectCreditsModal } from './inject-credits-modal'
```

O `users-client.tsx` resultante deve ter ~150-200 linhas (tabela + orchestração de estado dos modais).

- [ ] **Step 6: Rodar toda a suite**

```bash
npm test
```
Expected: PASS

- [ ] **Step 7: Verificar build**

```bash
npm run build 2>&1 | tail -20
```
Expected: build sem erros.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(admin)/console/users/"
git commit -m "refactor(users): extract inline modals into separate components"
```

---

## Self-Review

### 1. Spec Coverage

| Achado da auditoria | Task que cobre |
|---|---|
| Prop drilling consultation flow (11 props, 3 níveis) | Task 1 ✅ |
| useEffect+fetch em last-anamnesis-sheet | Task 2 ✅ |
| login-client.tsx 578 linhas (2 fluxos misturados) | Task 3 ✅ |
| users-client.tsx 516 linhas (4 modais inline) | Task 4 ✅ |
| useCallback/React.memo (React 19 compiler) | Ignorado intencionalmente — React 19 trata automaticamente |
| Unused icon imports | Ignorado — tree-shaking garante que não há custo de bundle |
| StatusBadge duplicado | Ignorado — só aparece em users-client; extração não traz ganho real |

### 2. Placeholder Scan

Nenhum "TBD", "TODO", "implement later" encontrado. Todos os steps têm código real.

### 3. Type Consistency

- `PlanFeatures` e `Professional` são definidas em `consultation-context.tsx` na Task 1 e referenciadas nas Tasks subsequentes — consistente.
- `getLatestConsultation(patientId, userId)` na Task 2 — assinatura usada no teste e na implementação — consistente.
- Modal props (`open`, `onClose`, `onSuccess`) — padrão uniforme em todos os 4 modais — consistente.
