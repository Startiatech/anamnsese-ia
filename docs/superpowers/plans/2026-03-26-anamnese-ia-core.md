# Anamnese IA — Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js web app where a medical professional uploads a consultation audio, the system transcribes and structures it into a SOAP anamnesis, and exports the result as PDF or DOCX.

**Architecture:** Next.js App Router (TypeScript + Tailwind CSS) with a repository abstraction layer over localStorage (mirroring future Supabase schema). AI calls (Groq Whisper + LLaMA) are mocked via environment flag. React Context manages consultation flow state across steps.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, React Hook Form, Zod, Vitest + React Testing Library, @react-pdf/renderer, docx (npm), uuid

---

## File Map

```
app/
  page.tsx                          → redirect to /pacientes
  pacientes/
    page.tsx                        → patient list + search
    novo/
      page.tsx                      → new patient form
  atendimento/
    [id]/
      page.tsx                      → consultation flow (steps 1-5)
  resultado/
    [id]/
      page.tsx                      → final anamnesis + export
  api/
    transcribe/
      route.ts                      → mock/real Groq Whisper
    anamnesis/
      route.ts                      → mock/real Groq LLM
    export/
      route.ts                      → PDF or DOCX generation

components/
  ui/                               → shadcn/ui components (auto-generated via CLI)
    button.tsx, input.tsx, card.tsx, badge.tsx, checkbox.tsx, textarea.tsx, label.tsx, separator.tsx
  steps/
    StepIndicator.tsx               → progress indicator (1-5 steps)
    StepPatient.tsx                 → step 1: patient selection/creation inline
    StepResponsibility.tsx          → step 2: responsibility confirmation checkbox
    StepAudio.tsx                   → step 3: audio upload
    StepSections.tsx                → step 4: raw transcript + section customization
    StepAnamnesis.tsx               → step 5: structured anamnesis editor
  patients/
    PatientCard.tsx                 → patient summary card
    PatientSearchInput.tsx          → search input with results dropdown
  export/
    ExportButtons.tsx               → PDF and DOCX export buttons

lib/
  db.ts                             → repository abstraction (localStorage / Supabase)
  mock/
    ai.ts                           → mock transcription and anamnesis responses
  pdf.ts                            → PDF document generation (@react-pdf/renderer)
  docx.ts                           → DOCX document generation (docx npm)
  utils.ts                          → formatCPF, formatDate, generateId helpers

types/
  index.ts                          → Patient, Consultation, Section, ConsultationStep

context/
  ConsultationContext.tsx           → provider for consultation flow state

hooks/
  usePatients.ts                    → CRUD hooks for patients
  useConsultation.ts                → hooks for consultation read/write
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json` (via CLI)
- Create: `tailwind.config.ts`
- Create: `.env.local`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`

- [ ] **Step 1: Scaffold Next.js project**

```bash
cd d:/REPOS-GITHUB-PARTICULAR/project-anamnese-ia-claude-code-repo-local
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir=no --import-alias="@/*"
```

Expected: project created with `app/`, `components/`, `public/` directories.

- [ ] **Step 2: Install dependencies**

```bash
npm install uuid @react-pdf/renderer docx react-hook-form zod @hookform/resolvers
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
npm install -D @types/uuid
```

- [ ] **Step 2b: Initialize shadcn/ui**

```bash
npx shadcn@latest init
```

When prompted, choose:
- Style: **Default**
- Base color: **Slate**
- CSS variables: **Yes**

Then add the components used in this project:

```bash
npx shadcn@latest add button input card badge checkbox textarea label separator
```

- [ ] **Step 3: Create `.env.local`**

```bash
# .env.local
NEXT_PUBLIC_MOCK_AI=true
GROQ_API_KEY=your_groq_api_key_here

# Mock doctor data (used in exports during test phase)
NEXT_PUBLIC_DOCTOR_NAME=Dr. Nome Completo
NEXT_PUBLIC_DOCTOR_CRM=12345/SP
NEXT_PUBLIC_DOCTOR_SPECIALTY=Clínica Geral
```

- [ ] **Step 4: Create `vitest.config.ts`**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
```

- [ ] **Step 5: Create `vitest.setup.ts`**

```typescript
// vitest.setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 6: Add test script to `package.json`**

Open `package.json` and add to `"scripts"`:

```json
"test": "vitest",
"test:run": "vitest run"
```

- [ ] **Step 7: Verify setup**

```bash
npm run test:run
```

Expected: `No test files found` (no errors, just no tests yet).

- [ ] **Step 8: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Next.js project with Vitest and dependencies"
```

---

## Task 2: Types

**Files:**
- Create: `types/index.ts`
- Create: `types/index.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// types/index.test.ts
import { describe, it, expect } from 'vitest'
import type { Patient, Consultation, Section, ConsultationStep } from './index'

describe('types', () => {
  it('Patient has required fields', () => {
    const patient: Patient = {
      id: '123',
      name: 'João Silva',
      cpf: '123.456.789-00',
      createdAt: new Date().toISOString(),
    }
    expect(patient.id).toBeDefined()
    expect(patient.name).toBeDefined()
    expect(patient.cpf).toBeDefined()
  })

  it('Consultation has patient_id and structured anamnesis', () => {
    const section: Section = { title: 'Subjetivo', content: 'Paciente relata...' }
    const consultation: Consultation = {
      id: '456',
      patientId: '123',
      rawTranscript: 'texto bruto',
      structuredAnamnesis: { sections: [section] },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    expect(consultation.structuredAnamnesis.sections).toHaveLength(1)
  })

  it('ConsultationStep covers all 5 steps', () => {
    const steps: ConsultationStep[] = [1, 2, 3, 4, 5]
    expect(steps).toHaveLength(5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- types/index.test.ts
```

Expected: FAIL — `Cannot find module './index'`

- [ ] **Step 3: Create `types/index.ts`**

```typescript
// types/index.ts

export interface Patient {
  id: string
  name: string
  cpf: string
  birthDate?: string      // ISO date string: "YYYY-MM-DD"
  phone?: string
  createdAt: string       // ISO datetime string
}

export interface Section {
  title: string
  content: string
}

export interface StructuredAnamnesis {
  sections: Section[]
}

export interface Consultation {
  id: string
  patientId: string
  rawTranscript: string
  structuredAnamnesis: StructuredAnamnesis
  createdAt: string
  updatedAt: string
}

export type ConsultationStep = 1 | 2 | 3 | 4 | 5

export interface ConsultationFlowState {
  step: ConsultationStep
  patient: Patient | null
  rawTranscript: string
  selectedSections: string[]
  structuredAnamnesis: StructuredAnamnesis | null
}

// Default SOAP section titles offered to the professional
export const DEFAULT_SOAP_SECTIONS = [
  'Subjetivo (S)',
  'Objetivo (O)',
  'Avaliação (A)',
  'Plano (P)',
] as const
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:run -- types/index.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add types/
git commit -m "feat: add domain types (Patient, Consultation, Section)"
```

---

## Task 3: Utilities

**Files:**
- Create: `lib/utils.ts`
- Create: `lib/utils.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
// lib/utils.test.ts
import { describe, it, expect } from 'vitest'
import { formatCPF, validateCPFFormat, formatDate, generateId } from './utils'

describe('formatCPF', () => {
  it('formats raw CPF digits', () => {
    expect(formatCPF('12345678900')).toBe('123.456.789-00')
  })
  it('returns already formatted CPF unchanged', () => {
    expect(formatCPF('123.456.789-00')).toBe('123.456.789-00')
  })
})

describe('validateCPFFormat', () => {
  it('accepts formatted CPF', () => {
    expect(validateCPFFormat('123.456.789-00')).toBe(true)
  })
  it('rejects incomplete CPF', () => {
    expect(validateCPFFormat('123.456')).toBe(false)
  })
  it('rejects empty string', () => {
    expect(validateCPFFormat('')).toBe(false)
  })
})

describe('formatDate', () => {
  it('formats ISO date to DD/MM/YYYY', () => {
    expect(formatDate('2024-03-15')).toBe('15/03/2024')
  })
  it('formats ISO datetime to DD/MM/YYYY', () => {
    expect(formatDate('2024-03-15T10:30:00.000Z')).toBe('15/03/2024')
  })
})

describe('generateId', () => {
  it('generates a non-empty string', () => {
    expect(generateId().length).toBeGreaterThan(0)
  })
  it('generates unique ids', () => {
    expect(generateId()).not.toBe(generateId())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- lib/utils.test.ts
```

Expected: FAIL

- [ ] **Step 3: Create `lib/utils.ts`**

```typescript
// lib/utils.ts
import { v4 as uuidv4 } from 'uuid'

export function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 11) return value
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

export function validateCPFFormat(value: string): boolean {
  return /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(value)
}

export function formatDate(isoString: string): string {
  const date = new Date(isoString)
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const year = date.getUTCFullYear()
  return `${day}/${month}/${year}`
}

export function formatDateTime(isoString: string): string {
  const date = new Date(isoString)
  return `${formatDate(isoString)} às ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function generateId(): string {
  return uuidv4()
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:run -- lib/utils.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/utils.ts lib/utils.test.ts
git commit -m "feat: add utility functions (formatCPF, formatDate, generateId)"
```

---

## Task 4: Data Layer (localStorage Repository)

**Files:**
- Create: `lib/db.ts`
- Create: `lib/db.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
// lib/db.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { PatientRepository, ConsultationRepository } from './db'
import type { Patient, Consultation } from '@/types'

const mockPatient: Patient = {
  id: 'p1',
  name: 'Maria Oliveira',
  cpf: '111.222.333-44',
  createdAt: new Date().toISOString(),
}

const mockConsultation: Consultation = {
  id: 'c1',
  patientId: 'p1',
  rawTranscript: 'Paciente queixa-se de dor de cabeça.',
  structuredAnamnesis: { sections: [{ title: 'Subjetivo (S)', content: 'Dor de cabeça' }] },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

beforeEach(() => {
  localStorage.clear()
})

describe('PatientRepository', () => {
  it('saves and retrieves a patient', () => {
    PatientRepository.save(mockPatient)
    const found = PatientRepository.findById('p1')
    expect(found?.name).toBe('Maria Oliveira')
  })

  it('returns null for unknown id', () => {
    expect(PatientRepository.findById('unknown')).toBeNull()
  })

  it('finds patient by CPF', () => {
    PatientRepository.save(mockPatient)
    const found = PatientRepository.findByCPF('111.222.333-44')
    expect(found?.id).toBe('p1')
  })

  it('lists all patients', () => {
    PatientRepository.save(mockPatient)
    expect(PatientRepository.findAll()).toHaveLength(1)
  })

  it('updates existing patient', () => {
    PatientRepository.save(mockPatient)
    PatientRepository.save({ ...mockPatient, name: 'Maria Santos' })
    expect(PatientRepository.findAll()).toHaveLength(1)
    expect(PatientRepository.findById('p1')?.name).toBe('Maria Santos')
  })
})

describe('ConsultationRepository', () => {
  it('saves and retrieves consultation by patient', () => {
    ConsultationRepository.save(mockConsultation)
    const found = ConsultationRepository.findByPatientId('p1')
    expect(found?.id).toBe('c1')
  })

  it('overwrites previous consultation for same patient', () => {
    ConsultationRepository.save(mockConsultation)
    ConsultationRepository.save({ ...mockConsultation, id: 'c2', rawTranscript: 'novo texto' })
    const found = ConsultationRepository.findByPatientId('p1')
    expect(found?.rawTranscript).toBe('novo texto')
    expect(ConsultationRepository.findAll()).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- lib/db.test.ts
```

Expected: FAIL

- [ ] **Step 3: Create `lib/db.ts`**

```typescript
// lib/db.ts
import type { Patient, Consultation } from '@/types'

const PATIENTS_KEY = 'anamnese_patients'
const CONSULTATIONS_KEY = 'anamnese_consultations'

function readStorage<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as T[]
  } catch {
    return []
  }
}

function writeStorage<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data))
}

export const PatientRepository = {
  findAll(): Patient[] {
    return readStorage<Patient>(PATIENTS_KEY)
  },

  findById(id: string): Patient | null {
    return this.findAll().find(p => p.id === id) ?? null
  },

  findByCPF(cpf: string): Patient | null {
    return this.findAll().find(p => p.cpf === cpf) ?? null
  },

  search(query: string): Patient[] {
    const q = query.toLowerCase()
    return this.findAll().filter(
      p => p.name.toLowerCase().includes(q) || p.cpf.includes(q)
    )
  },

  save(patient: Patient): void {
    const all = this.findAll()
    const idx = all.findIndex(p => p.id === patient.id)
    if (idx >= 0) {
      all[idx] = patient
    } else {
      all.push(patient)
    }
    writeStorage(PATIENTS_KEY, all)
  },
}

export const ConsultationRepository = {
  findAll(): Consultation[] {
    return readStorage<Consultation>(CONSULTATIONS_KEY)
  },

  findByPatientId(patientId: string): Consultation | null {
    return this.findAll().find(c => c.patientId === patientId) ?? null
  },

  save(consultation: Consultation): void {
    const all = this.findAll().filter(c => c.patientId !== consultation.patientId)
    all.push(consultation)
    writeStorage(CONSULTATIONS_KEY, all)
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:run -- lib/db.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/db.ts lib/db.test.ts
git commit -m "feat: add localStorage repository for patients and consultations"
```

---

## Task 5: Mock AI Layer

**Files:**
- Create: `lib/mock/ai.ts`
- Create: `lib/mock/ai.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
// lib/mock/ai.test.ts
import { describe, it, expect } from 'vitest'
import { mockTranscribe, mockGenerateAnamnesis } from './ai'

describe('mockTranscribe', () => {
  it('returns a non-empty transcript string', async () => {
    const result = await mockTranscribe()
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(50)
  })
})

describe('mockGenerateAnamnesis', () => {
  it('returns sections matching requested titles', async () => {
    const sections = ['Subjetivo (S)', 'Plano (P)']
    const result = await mockGenerateAnamnesis('qualquer texto', sections)
    expect(result.sections).toHaveLength(2)
    expect(result.sections[0].title).toBe('Subjetivo (S)')
    expect(result.sections[1].title).toBe('Plano (P)')
  })

  it('each section has non-empty content', async () => {
    const result = await mockGenerateAnamnesis('texto', ['Avaliação (A)'])
    expect(result.sections[0].content.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- lib/mock/ai.test.ts
```

Expected: FAIL

- [ ] **Step 3: Create `lib/mock/ai.ts`**

```typescript
// lib/mock/ai.ts
import type { StructuredAnamnesis } from '@/types'

const MOCK_TRANSCRIPT = `
Paciente do sexo feminino, 42 anos, comparece à consulta referindo cefaleia há três dias,
de forte intensidade, localizada na região frontal e temporal bilateral. Relata que a dor
piora com exposição à luz e barulho. Nega febre, náuseas ou vômitos. Faz uso de ibuprofeno
com alívio parcial. Antecedentes: hipertensão arterial sistêmica em tratamento com losartana
50mg. Ao exame físico: PA 140/90 mmHg, FC 78 bpm, temperatura axilar 36,5°C. Orientada,
sem rigidez de nuca, pupilas isocóricas e fotorreagentes. Conduta: ajuste da anti-hipertensiva,
solicitar hemograma e bioquímica, retorno em 15 dias.
`.trim()

const MOCK_CONTENT: Record<string, string> = {
  'Subjetivo (S)': 'Paciente feminina, 42 anos, queixa-se de cefaleia há 3 dias de forte intensidade, localização frontal e temporal bilateral, com piora à fotofobia e fonofobia. Nega febre, náuseas ou vômitos. Em uso de ibuprofeno com alívio parcial. Antecedente de hipertensão arterial sistêmica em uso de losartana 50mg.',
  'Objetivo (O)': 'PA: 140/90 mmHg | FC: 78 bpm | Temperatura axilar: 36,5°C. Paciente orientada, sem rigidez de nuca. Pupilas isocóricas e fotorreagentes bilateralmente.',
  'Avaliação (A)': 'Cefaleia tensional associada a HAS descompensada. Excluir outras causas secundárias de cefaleia.',
  'Plano (P)': 'Ajuste da medicação anti-hipertensiva (avaliar aumento de dose da losartana). Solicitados: hemograma completo e bioquímica sérica. Orientada sobre higiene do sono e manejo do estresse. Retorno agendado em 15 dias.',
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function mockTranscribe(): Promise<string> {
  await delay(1500)
  return MOCK_TRANSCRIPT
}

export async function mockGenerateAnamnesis(
  _transcript: string,
  sectionTitles: string[]
): Promise<StructuredAnamnesis> {
  await delay(2000)
  return {
    sections: sectionTitles.map(title => ({
      title,
      content: MOCK_CONTENT[title] ?? `Conteúdo gerado para a seção "${title}" com base na transcrição da consulta.`,
    })),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:run -- lib/mock/ai.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/mock/
git commit -m "feat: add mock AI layer for transcription and anamnesis generation"
```

---

## Task 6: API Routes (with mock flag)

**Files:**
- Create: `app/api/transcribe/route.ts`
- Create: `app/api/anamnesis/route.ts`

- [ ] **Step 1: Create `app/api/transcribe/route.ts`**

```typescript
// app/api/transcribe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { mockTranscribe } from '@/lib/mock/ai'

export async function POST(req: NextRequest) {
  const isMock = process.env.NEXT_PUBLIC_MOCK_AI === 'true'

  if (isMock) {
    const transcript = await mockTranscribe()
    return NextResponse.json({ transcript })
  }

  // Production: Groq Whisper
  const formData = await req.formData()
  const file = formData.get('audio') as File | null

  if (!file) {
    return NextResponse.json({ error: 'Arquivo de áudio não enviado.' }, { status: 400 })
  }

  const { Groq } = await import('groq-sdk')
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  const transcription = await groq.audio.transcriptions.create({
    file,
    model: 'whisper-large-v3-turbo',
    language: 'pt',
  })

  return NextResponse.json({ transcript: transcription.text })
}
```

- [ ] **Step 2: Create `app/api/anamnesis/route.ts`**

```typescript
// app/api/anamnesis/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { mockGenerateAnamnesis } from '@/lib/mock/ai'

export async function POST(req: NextRequest) {
  const isMock = process.env.NEXT_PUBLIC_MOCK_AI === 'true'
  const body = await req.json() as { transcript: string; sections: string[] }

  if (!body.transcript || !body.sections?.length) {
    return NextResponse.json({ error: 'transcript e sections são obrigatórios.' }, { status: 400 })
  }

  if (isMock) {
    const result = await mockGenerateAnamnesis(body.transcript, body.sections)
    return NextResponse.json(result)
  }

  // Production: Groq LLM
  const { Groq } = await import('groq-sdk')
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  const sectionsPrompt = body.sections.map(s => `- ${s}`).join('\n')

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: `Você é um assistente médico especializado em estruturar anamneses.
Dado um texto bruto de consulta médica, extraia e estruture APENAS as seções solicitadas.
Responda em JSON com o formato: { "sections": [{ "title": "string", "content": "string" }] }
Escreva em português formal e objetivo. Não invente informações que não estejam no texto.`,
      },
      {
        role: 'user',
        content: `Texto da consulta:\n${body.transcript}\n\nSeções a extrair:\n${sectionsPrompt}`,
      },
    ],
    response_format: { type: 'json_object' },
  })

  const parsed = JSON.parse(completion.choices[0].message.content ?? '{}')
  return NextResponse.json(parsed)
}
```

- [ ] **Step 3: Verify routes don't have TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: no errors (or only warnings about groq-sdk not installed — install if needed: `npm install groq-sdk`)

- [ ] **Step 4: Commit**

```bash
git add app/api/
git commit -m "feat: add API routes for transcription and anamnesis (mock + production)"
```

---

## Task 7: Zod Schemas + shadcn/ui Spinner

> shadcn/ui components (button, input, card, etc.) were installed in Task 1 via CLI and live in `components/ui/`. This task adds the Zod validation schemas used across forms, and a Spinner component (not included in shadcn).

**Files:**
- Create: `lib/schemas.ts`
- Create: `lib/schemas.test.ts`
- Create: `components/ui/spinner.tsx`

- [ ] **Step 1: Write the tests**

```typescript
// lib/schemas.test.ts
import { describe, it, expect } from 'vitest'
import { patientSchema, responsibilitySchema } from './schemas'

describe('patientSchema', () => {
  it('accepts valid patient data', () => {
    const result = patientSchema.safeParse({ name: 'Maria Silva', cpf: '123.456.789-00' })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = patientSchema.safeParse({ name: '', cpf: '123.456.789-00' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path[0]).toBe('name')
  })

  it('rejects invalid CPF format', () => {
    const result = patientSchema.safeParse({ name: 'João', cpf: '12345' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path[0]).toBe('cpf')
  })

  it('accepts optional fields', () => {
    const result = patientSchema.safeParse({
      name: 'João',
      cpf: '123.456.789-00',
      birthDate: '1990-05-20',
      phone: '(11) 99999-9999',
    })
    expect(result.success).toBe(true)
  })
})

describe('responsibilitySchema', () => {
  it('accepts confirmed=true', () => {
    const result = responsibilitySchema.safeParse({ confirmed: true })
    expect(result.success).toBe(true)
  })

  it('rejects confirmed=false', () => {
    const result = responsibilitySchema.safeParse({ confirmed: false })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- lib/schemas.test.ts
```

Expected: FAIL

- [ ] **Step 3: Create `lib/schemas.ts`**

```typescript
// lib/schemas.ts
import { z } from 'zod'

export const patientSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').trim(),
  cpf: z
    .string()
    .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'CPF inválido — use o formato 000.000.000-00'),
  birthDate: z.string().optional(),
  phone: z.string().optional(),
})

export type PatientFormData = z.infer<typeof patientSchema>

export const responsibilitySchema = z.object({
  confirmed: z.literal(true, {
    errorMap: () => ({ message: 'É necessário confirmar a autorização para continuar.' }),
  }),
})

export type ResponsibilityFormData = z.infer<typeof responsibilitySchema>
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:run -- lib/schemas.test.ts
```

Expected: PASS

- [ ] **Step 5: Create `components/ui/spinner.tsx`**

```typescript
// components/ui/spinner.tsx
import { cn } from '@/lib/utils'

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      role="status"
      aria-label="Carregando"
      viewBox="0 0 24 24"
      fill="none"
      className={cn('h-4 w-4 animate-spin', className)}
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/schemas.ts lib/schemas.test.ts components/ui/spinner.tsx
git commit -m "feat: add Zod validation schemas and Spinner component"
```

---

## Task 8: Hooks

**Files:**
- Create: `hooks/usePatients.ts`
- Create: `hooks/useConsultation.ts`
- Create: `hooks/usePatients.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
// hooks/usePatients.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePatients } from './usePatients'

beforeEach(() => localStorage.clear())

describe('usePatients', () => {
  it('starts with empty list', () => {
    const { result } = renderHook(() => usePatients())
    expect(result.current.patients).toHaveLength(0)
  })

  it('creates a patient', () => {
    const { result } = renderHook(() => usePatients())
    act(() => {
      result.current.createPatient({ name: 'João', cpf: '111.222.333-44' })
    })
    expect(result.current.patients).toHaveLength(1)
    expect(result.current.patients[0].name).toBe('João')
  })

  it('searches patients by name', () => {
    const { result } = renderHook(() => usePatients())
    act(() => {
      result.current.createPatient({ name: 'Maria Silva', cpf: '111.111.111-11' })
      result.current.createPatient({ name: 'João Santos', cpf: '222.222.222-22' })
    })
    act(() => { result.current.setSearch('maria') })
    expect(result.current.filteredPatients).toHaveLength(1)
    expect(result.current.filteredPatients[0].name).toBe('Maria Silva')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- hooks/usePatients.test.ts
```

Expected: FAIL

- [ ] **Step 3: Create `hooks/usePatients.ts`**

```typescript
// hooks/usePatients.ts
'use client'
import { useState, useCallback } from 'react'
import { PatientRepository } from '@/lib/db'
import { generateId } from '@/lib/utils'
import type { Patient } from '@/types'

interface CreatePatientInput {
  name: string
  cpf: string
  birthDate?: string
  phone?: string
}

export function usePatients() {
  const [patients, setPatients] = useState<Patient[]>(() => PatientRepository.findAll())
  const [search, setSearch] = useState('')

  const refresh = useCallback(() => {
    setPatients(PatientRepository.findAll())
  }, [])

  const createPatient = useCallback((input: CreatePatientInput): Patient => {
    const patient: Patient = {
      id: generateId(),
      ...input,
      createdAt: new Date().toISOString(),
    }
    PatientRepository.save(patient)
    refresh()
    return patient
  }, [refresh])

  const filteredPatients = search.trim()
    ? PatientRepository.search(search)
    : patients

  return { patients, filteredPatients, search, setSearch, createPatient, refresh }
}
```

- [ ] **Step 4: Create `hooks/useConsultation.ts`**

```typescript
// hooks/useConsultation.ts
'use client'
import { useCallback } from 'react'
import { ConsultationRepository } from '@/lib/db'
import { generateId } from '@/lib/utils'
import type { Consultation, StructuredAnamnesis } from '@/types'

export function useConsultation(patientId: string) {
  const getConsultation = useCallback((): Consultation | null => {
    return ConsultationRepository.findByPatientId(patientId)
  }, [patientId])

  const saveConsultation = useCallback((
    rawTranscript: string,
    structuredAnamnesis: StructuredAnamnesis
  ): Consultation => {
    const existing = ConsultationRepository.findByPatientId(patientId)
    const now = new Date().toISOString()
    const consultation: Consultation = {
      id: existing?.id ?? generateId(),
      patientId,
      rawTranscript,
      structuredAnamnesis,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    ConsultationRepository.save(consultation)
    return consultation
  }, [patientId])

  return { getConsultation, saveConsultation }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm run test:run -- hooks/usePatients.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add hooks/
git commit -m "feat: add usePatients and useConsultation hooks"
```

---

## Task 9: Consultation Context (Flow State)

**Files:**
- Create: `context/ConsultationContext.tsx`
- Create: `context/ConsultationContext.test.tsx`

- [ ] **Step 1: Write the test**

```typescript
// context/ConsultationContext.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConsultationProvider, useConsultationFlow } from './ConsultationContext'

function TestConsumer() {
  const { state, setPatient, nextStep, prevStep } = useConsultationFlow()
  return (
    <div>
      <span data-testid="step">{state.step}</span>
      <button onClick={() => setPatient({ id: 'p1', name: 'João', cpf: '111.111.111-11', createdAt: '' })}>
        Set Patient
      </button>
      <button onClick={nextStep}>Next</button>
      <button onClick={prevStep}>Prev</button>
    </div>
  )
}

describe('ConsultationContext', () => {
  it('starts at step 1', () => {
    render(<ConsultationProvider><TestConsumer /></ConsultationProvider>)
    expect(screen.getByTestId('step').textContent).toBe('1')
  })

  it('advances to step 2', async () => {
    render(<ConsultationProvider><TestConsumer /></ConsultationProvider>)
    await userEvent.click(screen.getByText('Next'))
    expect(screen.getByTestId('step').textContent).toBe('2')
  })

  it('does not go below step 1', async () => {
    render(<ConsultationProvider><TestConsumer /></ConsultationProvider>)
    await userEvent.click(screen.getByText('Prev'))
    expect(screen.getByTestId('step').textContent).toBe('1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- context/ConsultationContext.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Create `context/ConsultationContext.tsx`**

```typescript
// context/ConsultationContext.tsx
'use client'
import { createContext, useContext, useState, ReactNode } from 'react'
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

const initialState: ConsultationFlowState = {
  step: 1,
  patient: null,
  rawTranscript: '',
  selectedSections: [],
  structuredAnamnesis: null,
}

const ConsultationContext = createContext<ConsultationContextValue | null>(null)

export function ConsultationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConsultationFlowState>(initialState)

  const setPatient = (patient: Patient) =>
    setState(s => ({ ...s, patient }))

  const setRawTranscript = (rawTranscript: string) =>
    setState(s => ({ ...s, rawTranscript }))

  const setSelectedSections = (selectedSections: string[]) =>
    setState(s => ({ ...s, selectedSections }))

  const setStructuredAnamnesis = (structuredAnamnesis: StructuredAnamnesis) =>
    setState(s => ({ ...s, structuredAnamnesis }))

  const nextStep = () =>
    setState(s => ({ ...s, step: Math.min(5, s.step + 1) as ConsultationStep }))

  const prevStep = () =>
    setState(s => ({ ...s, step: Math.max(1, s.step - 1) as ConsultationStep }))

  const reset = () => setState(initialState)

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

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:run -- context/ConsultationContext.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add context/
git commit -m "feat: add ConsultationContext for multi-step flow state"
```

---

## Task 10: Step Components

**Files:**
- Create: `components/steps/StepIndicator.tsx`
- Create: `components/steps/StepPatient.tsx`
- Create: `components/steps/StepResponsibility.tsx`
- Create: `components/steps/StepAudio.tsx`
- Create: `components/steps/StepSections.tsx`
- Create: `components/steps/StepAnamnesis.tsx`
- Create: `components/steps/StepIndicator.test.tsx`

- [ ] **Step 1: Write StepIndicator test**

```typescript
// components/steps/StepIndicator.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StepIndicator } from './StepIndicator'

describe('StepIndicator', () => {
  it('renders 5 steps', () => {
    render(<StepIndicator currentStep={1} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
  })

  it('marks current step as active', () => {
    render(<StepIndicator currentStep={3} />)
    expect(screen.getByLabelText('Passo atual: 3')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- components/steps/StepIndicator.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Create `components/steps/StepIndicator.tsx`**

```typescript
// components/steps/StepIndicator.tsx
import type { ConsultationStep } from '@/types'

const STEP_LABELS: Record<ConsultationStep, string> = {
  1: 'Paciente',
  2: 'Autorização',
  3: 'Áudio',
  4: 'Revisão',
  5: 'Anamnese',
}

interface StepIndicatorProps {
  currentStep: ConsultationStep
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const steps: ConsultationStep[] = [1, 2, 3, 4, 5]
  return (
    <ol className="flex items-center gap-2" aria-label="Progresso do atendimento">
      {steps.map((step, idx) => {
        const isCompleted = step < currentStep
        const isCurrent = step === currentStep
        return (
          <li key={step} className="flex items-center gap-2">
            <div
              aria-label={isCurrent ? `Passo atual: ${step}` : undefined}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                isCompleted
                  ? 'bg-blue-600 text-white'
                  : isCurrent
                  ? 'border-2 border-blue-600 text-blue-600'
                  : 'border-2 border-gray-300 text-gray-400'
              }`}
            >
              {isCompleted ? '✓' : step}
            </div>
            <span className={`hidden text-xs sm:block ${isCurrent ? 'font-medium text-blue-600' : 'text-gray-500'}`}>
              {STEP_LABELS[step]}
            </span>
            {idx < steps.length - 1 && (
              <div className={`h-px w-6 ${isCompleted ? 'bg-blue-600' : 'bg-gray-200'}`} />
            )}
          </li>
        )
      })}
    </ol>
  )
}
```

- [ ] **Step 4: Create `components/steps/StepPatient.tsx`**

```typescript
// components/steps/StepPatient.tsx
'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { usePatients } from '@/hooks/usePatients'
import { useConsultationFlow } from '@/context/ConsultationContext'
import { formatCPF } from '@/lib/utils'
import { patientSchema, type PatientFormData } from '@/lib/schemas'
import type { Patient } from '@/types'

export function StepPatient() {
  const { filteredPatients, search, setSearch, createPatient } = usePatients()
  const { setPatient, nextStep, state } = useConsultationFlow()
  const [showForm, setShowForm] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    mode: 'onChange',
  })

  function handleSelect(patient: Patient) {
    setPatient(patient)
    nextStep()
  }

  function onSubmit(data: PatientFormData) {
    const patient = createPatient({
      name: data.name,
      cpf: data.cpf,
      birthDate: data.birthDate || undefined,
      phone: data.phone || undefined,
    })
    handleSelect(patient)
  }

  const cpfValue = watch('cpf') ?? ''

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">Selecionar Paciente</h2>

      {!showForm && (
        <>
          <div className="space-y-1">
            <Label htmlFor="search">Buscar por nome ou CPF</Label>
            <Input
              id="search"
              placeholder="Digite para buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {search && filteredPatients.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum paciente encontrado.</p>
          )}

          <ul className="space-y-2">
            {filteredPatients.map(p => (
              <li key={p.id}>
                <button
                  onClick={() => handleSelect(p)}
                  className={`w-full rounded-lg border px-4 py-3 text-left transition-colors hover:border-primary hover:bg-accent ${
                    state.patient?.id === p.id ? 'border-primary bg-accent' : 'border-border'
                  }`}
                >
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-muted-foreground">CPF: {p.cpf}</p>
                </button>
              </li>
            ))}
          </ul>

          <Button variant="outline" onClick={() => setShowForm(true)}>
            + Novo Paciente
          </Button>
        </>
      )}

      {showForm && (
        <Card>
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <h3 className="font-medium text-gray-700">Novo Paciente</h3>

              <div className="space-y-1">
                <Label htmlFor="name">Nome completo *</Label>
                <Input id="name" {...register('name')} autoFocus />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-1">
                <Label htmlFor="cpf">CPF *</Label>
                <Input
                  id="cpf"
                  placeholder="000.000.000-00"
                  maxLength={14}
                  value={cpfValue}
                  {...register('cpf')}
                  onChange={e => setValue('cpf', formatCPF(e.target.value), { shouldValidate: true })}
                />
                {errors.cpf && <p className="text-xs text-destructive">{errors.cpf.message}</p>}
              </div>

              <div className="space-y-1">
                <Label htmlFor="birthDate">Data de nascimento</Label>
                <Input id="birthDate" type="date" {...register('birthDate')} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="phone">Telefone</Label>
                <Input id="phone" placeholder="(00) 00000-0000" {...register('phone')} />
              </div>

              <div className="flex gap-2">
                <Button type="submit">Salvar e continuar</Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Create `components/steps/StepResponsibility.tsx`**

```typescript
// components/steps/StepResponsibility.tsx
'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useConsultationFlow } from '@/context/ConsultationContext'
import { responsibilitySchema, type ResponsibilityFormData } from '@/lib/schemas'

export function StepResponsibility() {
  const { nextStep, prevStep } = useConsultationFlow()

  const {
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ResponsibilityFormData>({
    resolver: zodResolver(responsibilitySchema),
    defaultValues: { confirmed: undefined },
  })

  const confirmed = watch('confirmed')

  function onSubmit() {
    nextStep()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">Autorização de Gravação</h2>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Este sistema processará a gravação de áudio da consulta utilizando inteligência artificial
            para transcrição e estruturação da anamnese.
          </p>
          <p className="text-sm text-muted-foreground">Ao continuar, você declara que:</p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 pl-2">
            <li>O paciente foi informado sobre a gravação da consulta;</li>
            <li>O paciente autorizou expressamente o uso deste sistema;</li>
            <li>Você assume a responsabilidade pelo cumprimento das normas de privacidade e sigilo médico.</li>
          </ul>
        </CardContent>
      </Card>

      <div className="space-y-1">
        <div className="flex items-start gap-3">
          <Checkbox
            id="confirmed"
            checked={confirmed === true}
            onCheckedChange={val => setValue('confirmed', val === true ? true : (undefined as unknown as true), { shouldValidate: true })}
          />
          <Label htmlFor="confirmed" className="cursor-pointer text-sm leading-relaxed">
            Confirmo que orientei o paciente sobre a gravação da consulta e que ele autorizou o uso deste sistema.
          </Label>
        </div>
        {errors.confirmed && (
          <p className="text-xs text-destructive">{errors.confirmed.message}</p>
        )}
      </div>

      <div className="flex gap-2">
        <Button type="submit">Continuar</Button>
        <Button type="button" variant="ghost" onClick={prevStep}>Voltar</Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 6: Create `components/steps/StepAudio.tsx`**

```typescript
// components/steps/StepAudio.tsx
'use client'
import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { useConsultationFlow } from '@/context/ConsultationContext'

const ACCEPTED_FORMATS = '.mp3,.wav,.m4a,.ogg'
const MAX_SIZE_MB = 25

export function StepAudio() {
  const { nextStep, prevStep, setRawTranscript } = useConsultationFlow()
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(selected: File) {
    const sizeMB = selected.size / (1024 * 1024)
    if (sizeMB > MAX_SIZE_MB) {
      setError(`Arquivo muito grande. Máximo: ${MAX_SIZE_MB}MB.`)
      return
    }
    setError('')
    setFile(selected)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const dropped = e.dataTransfer.files[0]
    if (dropped) handleFile(dropped)
  }

  async function handleProcess() {
    if (!file) return
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('audio', file)
      const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
      const data = await res.json() as { transcript?: string; error?: string }
      if (!res.ok || !data.transcript) throw new Error(data.error ?? 'Erro na transcrição')
      setRawTranscript(data.transcript)
      nextStep()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">Enviar Áudio da Consulta</h2>

      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="cursor-pointer rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary hover:bg-accent"
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
            <p className="font-medium text-gray-800">{file.name}</p>
            <p className="text-sm text-gray-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
            <p className="text-xs text-blue-600">Clique para trocar o arquivo</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-gray-600">Arraste o arquivo aqui ou clique para selecionar</p>
            <p className="text-sm text-gray-400">Formatos: MP3, WAV, M4A, OGG — Máximo: {MAX_SIZE_MB}MB</p>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button onClick={handleProcess} disabled={!file} loading={loading}>
          {loading ? 'Transcrevendo...' : 'Iniciar Processamento'}
        </Button>
        <Button variant="ghost" onClick={prevStep} disabled={loading}>Voltar</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Create `components/steps/StepSections.tsx`**

```typescript
// components/steps/StepSections.tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useConsultationFlow } from '@/context/ConsultationContext'
import { DEFAULT_SOAP_SECTIONS } from '@/types'

export function StepSections() {
  const { state, nextStep, prevStep, setSelectedSections, setStructuredAnamnesis } = useConsultationFlow()
  const [selected, setSelected] = useState<string[]>([...DEFAULT_SOAP_SECTIONS])
  const [extraInput, setExtraInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function toggleSection(title: string) {
    setSelected(prev =>
      prev.includes(title) ? prev.filter(s => s !== title) : [...prev, title]
    )
  }

  function addExtra() {
    const trimmed = extraInput.trim()
    if (!trimmed || selected.includes(trimmed)) return
    setSelected(prev => [...prev, trimmed])
    setExtraInput('')
  }

  function removeSection(title: string) {
    setSelected(prev => prev.filter(s => s !== title))
  }

  async function handleGenerate() {
    if (selected.length === 0) { setError('Selecione ao menos uma seção.'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/anamnesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: state.rawTranscript, sections: selected }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao gerar anamnese')
      setSelectedSections(selected)
      setStructuredAnamnesis(data)
      nextStep()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">Revisão e Seleção de Seções</h2>

      <Card padding="sm">
        <p className="text-xs font-medium uppercase text-gray-500 mb-2">Transcrição bruta</p>
        <p className="text-sm text-gray-700 whitespace-pre-wrap max-h-40 overflow-y-auto">{state.rawTranscript}</p>
      </Card>

      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">Seções da anamnese</p>
        <div className="flex flex-wrap gap-2">
          {selected.map(section => (
            <div key={section} className="flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1">
              <span className="text-sm text-blue-700">{section}</span>
              <button onClick={() => removeSection(section)} className="text-blue-400 hover:text-blue-600 ml-1 text-xs">✕</button>
            </div>
          ))}
        </div>

        {DEFAULT_SOAP_SECTIONS.filter(s => !selected.includes(s)).length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {DEFAULT_SOAP_SECTIONS.filter(s => !selected.includes(s)).map(s => (
              <button key={s} onClick={() => toggleSection(s)}
                className="rounded-full border border-gray-300 px-3 py-1 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600"
              >
                + {s}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Input
            placeholder="Adicionar seção personalizada..."
            value={extraInput}
            onChange={e => setExtraInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addExtra()}
          />
          <Button variant="secondary" onClick={addExtra} disabled={!extraInput.trim()}>Adicionar</Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button onClick={handleGenerate} loading={loading} disabled={selected.length === 0}>
          {loading ? 'Gerando anamnese...' : 'Gerar Anamnese'}
        </Button>
        <Button variant="ghost" onClick={prevStep} disabled={loading}>Voltar</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Create `components/steps/StepAnamnesis.tsx`**

```typescript
// components/steps/StepAnamnesis.tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { useConsultationFlow } from '@/context/ConsultationContext'
import { useConsultation } from '@/hooks/useConsultation'
import type { Section } from '@/types'

interface StepAnamnesisProps {
  onComplete: (consultationId: string) => void
}

export function StepAnamnesis({ onComplete }: StepAnamnesisProps) {
  const { state, prevStep, setStructuredAnamnesis } = useConsultationFlow()
  const { saveConsultation } = useConsultation(state.patient!.id)
  const [sections, setSections] = useState<Section[]>(state.structuredAnamnesis?.sections ?? [])
  const [saving, setSaving] = useState(false)

  function updateSection(index: number, content: string) {
    setSections(prev => prev.map((s, i) => i === index ? { ...s, content } : s))
  }

  async function handleSave() {
    setSaving(true)
    const updated = { sections }
    setStructuredAnamnesis(updated)
    const consultation = saveConsultation(state.rawTranscript, updated)
    onComplete(consultation.id)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">Anamnese Estruturada</h2>
      <p className="text-sm text-gray-500">Revise e edite o conteúdo antes de exportar.</p>

      <div className="space-y-4">
        {sections.map((section, idx) => (
          <Card key={section.title} padding="sm">
            <Textarea
              label={section.title}
              value={section.content}
              onChange={e => updateSection(idx, e.target.value)}
              rows={4}
            />
          </Card>
        ))}
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSave} loading={saving}>
          Salvar e exportar
        </Button>
        <Button variant="ghost" onClick={prevStep} disabled={saving}>Voltar</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 9: Run StepIndicator test to verify it passes**

```bash
npm run test:run -- components/steps/StepIndicator.test.tsx
```

Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add components/steps/
git commit -m "feat: add step components for consultation flow"
```

---

## Task 11: Pages

**Files:**
- Modify: `app/page.tsx`
- Create: `app/pacientes/page.tsx`
- Create: `app/pacientes/novo/page.tsx`
- Create: `app/atendimento/[id]/page.tsx`
- Create: `app/resultado/[id]/page.tsx`

- [ ] **Step 1: Update `app/page.tsx` (redirect)**

```typescript
// app/page.tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/pacientes')
}
```

- [ ] **Step 2: Create `app/pacientes/page.tsx`**

```typescript
// app/pacientes/page.tsx
'use client'
import Link from 'next/link'
import { Button, Input, Card, Badge } from '@/components/ui'
import { usePatients } from '@/hooks/usePatients'
import { useConsultationFlow } from '@/context/ConsultationContext'
import { ConsultationProvider } from '@/context/ConsultationContext'
import { ConsultationRepository } from '@/lib/db'

function PatientList() {
  const { filteredPatients, search, setSearch } = usePatients()

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pacientes</h1>
            <p className="text-sm text-gray-500">Selecione um paciente para iniciar o atendimento</p>
          </div>
          <Link href="/pacientes/novo">
            <Button>+ Novo Paciente</Button>
          </Link>
        </div>

        <Input
          placeholder="Buscar por nome ou CPF..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {filteredPatients.length === 0 ? (
          <Card>
            <p className="text-center text-sm text-gray-500 py-8">
              {search ? 'Nenhum paciente encontrado.' : 'Nenhum paciente cadastrado ainda.'}
            </p>
          </Card>
        ) : (
          <ul className="space-y-2">
            {filteredPatients.map(p => {
              const hasConsultation = !!ConsultationRepository.findByPatientId(p.id)
              return (
                <li key={p.id}>
                  <Link href={`/atendimento/${p.id}`} className="block">
                    <Card className="hover:border-blue-400 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-800">{p.name}</p>
                          <p className="text-sm text-gray-500">CPF: {p.cpf}</p>
                        </div>
                        {hasConsultation && <Badge variant="blue">Tem anamnese</Badge>}
                      </div>
                    </Card>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

export default function PacientesPage() {
  return (
    <ConsultationProvider>
      <PatientList />
    </ConsultationProvider>
  )
}
```

- [ ] **Step 3: Create `app/pacientes/novo/page.tsx`**

```typescript
// app/pacientes/novo/page.tsx
'use client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { usePatients } from '@/hooks/usePatients'
import { formatCPF } from '@/lib/utils'
import { patientSchema, type PatientFormData } from '@/lib/schemas'

export default function NovoPacientePage() {
  const router = useRouter()
  const { createPatient } = usePatients()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    mode: 'onChange',
  })

  const cpfValue = watch('cpf') ?? ''

  function onSubmit(data: PatientFormData) {
    const patient = createPatient({
      name: data.name,
      cpf: data.cpf,
      birthDate: data.birthDate || undefined,
      phone: data.phone || undefined,
    })
    router.push(`/atendimento/${patient.id}`)
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-lg space-y-6">
        <div>
          <Link href="/pacientes" className="text-sm text-primary hover:underline">← Voltar</Link>
          <h1 className="mt-2 text-2xl font-bold">Novo Paciente</h1>
        </div>

        <Card>
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="name">Nome completo *</Label>
                <Input id="name" {...register('name')} autoFocus />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-1">
                <Label htmlFor="cpf">CPF *</Label>
                <Input
                  id="cpf"
                  placeholder="000.000.000-00"
                  maxLength={14}
                  value={cpfValue}
                  {...register('cpf')}
                  onChange={e => setValue('cpf', formatCPF(e.target.value), { shouldValidate: true })}
                />
                {errors.cpf && <p className="text-xs text-destructive">{errors.cpf.message}</p>}
              </div>

              <div className="space-y-1">
                <Label htmlFor="birthDate">Data de nascimento</Label>
                <Input id="birthDate" type="date" {...register('birthDate')} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="phone">Telefone</Label>
                <Input id="phone" placeholder="(00) 00000-0000" {...register('phone')} />
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit">Salvar e iniciar atendimento</Button>
                <Link href="/pacientes">
                  <Button type="button" variant="ghost">Cancelar</Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `app/atendimento/[id]/page.tsx`**

```typescript
// app/atendimento/[id]/page.tsx
'use client'
import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ConsultationProvider, useConsultationFlow } from '@/context/ConsultationContext'
import { StepIndicator } from '@/components/steps/StepIndicator'
import { StepPatient } from '@/components/steps/StepPatient'
import { StepResponsibility } from '@/components/steps/StepResponsibility'
import { StepAudio } from '@/components/steps/StepAudio'
import { StepSections } from '@/components/steps/StepSections'
import { StepAnamnesis } from '@/components/steps/StepAnamnesis'
import { PatientRepository } from '@/lib/db'
import { Card } from '@/components/ui'

function AtendimentoFlow({ patientId }: { patientId: string }) {
  const { state, setPatient } = useConsultationFlow()
  const router = useRouter()

  useEffect(() => {
    const patient = PatientRepository.findById(patientId)
    if (!patient) { router.push('/pacientes'); return }
    setPatient(patient)
  }, [patientId, setPatient, router])

  function handleComplete(consultationId: string) {
    router.push(`/resultado/${consultationId}`)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Atendimento</h1>
          {state.patient && <p className="text-sm text-gray-500">{state.patient.name}</p>}
        </div>

        <StepIndicator currentStep={state.step} />

        <Card>
          {state.step === 1 && <StepPatient />}
          {state.step === 2 && <StepResponsibility />}
          {state.step === 3 && <StepAudio />}
          {state.step === 4 && <StepSections />}
          {state.step === 5 && <StepAnamnesis onComplete={handleComplete} />}
        </Card>
      </div>
    </div>
  )
}

export default function AtendimentoPage() {
  const { id } = useParams<{ id: string }>()
  return (
    <ConsultationProvider>
      <AtendimentoFlow patientId={id} />
    </ConsultationProvider>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add app/
git commit -m "feat: add pages (pacientes, novo paciente, atendimento flow)"
```

---

## Task 12: Export — PDF

**Files:**
- Create: `lib/pdf.ts`
- Create: `app/resultado/[id]/page.tsx`
- Create: `components/export/ExportButtons.tsx`

- [ ] **Step 1: Create `lib/pdf.ts`**

```typescript
// lib/pdf.ts
import {
  Document, Page, Text, View, StyleSheet, pdf
} from '@react-pdf/renderer'
import type { Patient, Consultation } from '@/types'
import { formatDate, formatDateTime } from './utils'
import { createElement } from 'react'

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 11, color: '#1a1a1a' },
  header: { marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#e0e0e0', paddingBottom: 12 },
  doctorName: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  doctorInfo: { fontSize: 10, color: '#555' },
  patientRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  patientLabel: { fontSize: 10, color: '#555' },
  patientValue: { fontSize: 10 },
  sectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 16, marginBottom: 4, color: '#1a4fa0' },
  sectionContent: { fontSize: 11, lineHeight: 1.5, color: '#333' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTopWidth: 1, borderTopColor: '#e0e0e0', paddingTop: 8, fontSize: 9, color: '#888', textAlign: 'center' },
})

interface PDFDocProps {
  patient: Patient
  consultation: Consultation
  doctorName: string
  doctorCRM: string
  doctorSpecialty: string
}

function AnamnesisDocument({ patient, consultation, doctorName, doctorCRM, doctorSpecialty }: PDFDocProps) {
  return createElement(Document, null,
    createElement(Page, { size: 'A4', style: styles.page },
      createElement(View, { style: styles.header },
        createElement(Text, { style: styles.doctorName }, doctorName),
        createElement(Text, { style: styles.doctorInfo }, `CRM: ${doctorCRM} | ${doctorSpecialty}`),
        createElement(View, { style: styles.patientRow },
          createElement(View, null,
            createElement(Text, { style: styles.patientLabel }, 'Paciente'),
            createElement(Text, { style: styles.patientValue }, patient.name),
          ),
          createElement(View, null,
            createElement(Text, { style: styles.patientLabel }, 'CPF'),
            createElement(Text, { style: styles.patientValue }, patient.cpf),
          ),
          createElement(View, null,
            createElement(Text, { style: styles.patientLabel }, 'Data da Consulta'),
            createElement(Text, { style: styles.patientValue }, formatDate(consultation.updatedAt)),
          ),
        ),
      ),
      ...consultation.structuredAnamnesis.sections.map(section =>
        createElement(View, { key: section.title },
          createElement(Text, { style: styles.sectionTitle }, section.title),
          createElement(Text, { style: styles.sectionContent }, section.content),
        )
      ),
      createElement(View, { style: styles.footer },
        createElement(Text, null, `Documento gerado em ${formatDateTime(new Date().toISOString())} — Anamnese IA`)
      ),
    )
  )
}

export async function generatePDFBlob(props: PDFDocProps): Promise<Blob> {
  const doc = createElement(AnamnesisDocument, props)
  return pdf(doc).toBlob()
}
```

- [ ] **Step 2: Create `lib/docx.ts`**

```typescript
// lib/docx.ts
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle, Table, TableRow, TableCell, WidthType
} from 'docx'
import type { Patient, Consultation } from '@/types'
import { formatDate, formatDateTime } from './utils'

interface DOCXProps {
  patient: Patient
  consultation: Consultation
  doctorName: string
  doctorCRM: string
  doctorSpecialty: string
}

export async function generateDOCXBlob({ patient, consultation, doctorName, doctorCRM, doctorSpecialty }: DOCXProps): Promise<Blob> {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [new TextRun({ text: doctorName, bold: true, size: 28 })],
        }),
        new Paragraph({
          children: [new TextRun({ text: `CRM: ${doctorCRM} | ${doctorSpecialty}`, size: 20, color: '555555' })],
        }),
        new Paragraph({ text: '' }),
        new Paragraph({
          children: [
            new TextRun({ text: `Paciente: ${patient.name}   |   CPF: ${patient.cpf}`, size: 22 }),
          ],
        }),
        ...(patient.birthDate ? [new Paragraph({
          children: [new TextRun({ text: `Data de Nascimento: ${formatDate(patient.birthDate)}`, size: 22 })],
        })] : []),
        new Paragraph({
          children: [new TextRun({ text: `Data da Consulta: ${formatDate(consultation.updatedAt)}`, size: 22 })],
        }),
        new Paragraph({ text: '' }),
        ...consultation.structuredAnamnesis.sections.flatMap(section => [
          new Paragraph({
            text: section.title,
            heading: HeadingLevel.HEADING_2,
          }),
          new Paragraph({
            children: [new TextRun({ text: section.content, size: 22 })],
          }),
          new Paragraph({ text: '' }),
        ]),
        new Paragraph({
          children: [new TextRun({
            text: `Documento gerado em ${formatDateTime(new Date().toISOString())} — Anamnese IA`,
            size: 18,
            color: '888888',
            italics: true,
          })],
        }),
      ],
    }],
  })

  const buffer = await Packer.toBuffer(doc)
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
}
```

- [ ] **Step 3: Create `components/export/ExportButtons.tsx`**

```typescript
// components/export/ExportButtons.tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui'
import type { Patient, Consultation } from '@/types'

interface ExportButtonsProps {
  patient: Patient
  consultation: Consultation
}

const doctorName = process.env.NEXT_PUBLIC_DOCTOR_NAME ?? 'Dr. Nome do Médico'
const doctorCRM = process.env.NEXT_PUBLIC_DOCTOR_CRM ?? '00000/UF'
const doctorSpecialty = process.env.NEXT_PUBLIC_DOCTOR_SPECIALTY ?? 'Especialidade'

export function ExportButtons({ patient, consultation }: ExportButtonsProps) {
  const [loadingPDF, setLoadingPDF] = useState(false)
  const [loadingDOCX, setLoadingDOCX] = useState(false)

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleExportPDF() {
    setLoadingPDF(true)
    try {
      const { generatePDFBlob } = await import('@/lib/pdf')
      const blob = await generatePDFBlob({ patient, consultation, doctorName, doctorCRM, doctorSpecialty })
      downloadBlob(blob, `anamnese-${patient.name.replace(/\s+/g, '-').toLowerCase()}.pdf`)
    } finally {
      setLoadingPDF(false)
    }
  }

  async function handleExportDOCX() {
    setLoadingDOCX(true)
    try {
      const { generateDOCXBlob } = await import('@/lib/docx')
      const blob = await generateDOCXBlob({ patient, consultation, doctorName, doctorCRM, doctorSpecialty })
      downloadBlob(blob, `anamnese-${patient.name.replace(/\s+/g, '-').toLowerCase()}.docx`)
    } finally {
      setLoadingDOCX(false)
    }
  }

  return (
    <div className="flex gap-3">
      <Button onClick={handleExportPDF} loading={loadingPDF}>
        Exportar PDF
      </Button>
      <Button variant="secondary" onClick={handleExportDOCX} loading={loadingDOCX}>
        Exportar DOCX
      </Button>
    </div>
  )
}
```

- [ ] **Step 4: Create `app/resultado/[id]/page.tsx`**

```typescript
// app/resultado/[id]/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, Badge } from '@/components/ui'
import { ExportButtons } from '@/components/export/ExportButtons'
import { ConsultationRepository, PatientRepository } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import type { Patient, Consultation } from '@/types'

export default function ResultadoPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [consultation, setConsultation] = useState<Consultation | null>(null)

  useEffect(() => {
    const allConsultations = ConsultationRepository.findAll()
    const found = allConsultations.find(c => c.id === id)
    if (!found) { router.push('/pacientes'); return }
    setConsultation(found)
    const p = PatientRepository.findById(found.patientId)
    if (!p) { router.push('/pacientes'); return }
    setPatient(p)
  }, [id, router])

  if (!consultation || !patient) return null

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <Link href="/pacientes" className="text-sm text-blue-600 hover:underline">← Pacientes</Link>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">Anamnese Concluída</h1>
            <p className="text-sm text-gray-500">{patient.name} — {formatDate(consultation.updatedAt)}</p>
          </div>
          <Badge variant="green">Pronto</Badge>
        </div>

        <Card>
          <div className="space-y-1 text-sm text-gray-600">
            <p><span className="font-medium">Paciente:</span> {patient.name}</p>
            <p><span className="font-medium">CPF:</span> {patient.cpf}</p>
            {patient.birthDate && <p><span className="font-medium">Nascimento:</span> {formatDate(patient.birthDate)}</p>}
          </div>
        </Card>

        {consultation.structuredAnamnesis.sections.map(section => (
          <Card key={section.title}>
            <h2 className="mb-2 font-semibold text-blue-700">{section.title}</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{section.content}</p>
          </Card>
        ))}

        <ExportButtons patient={patient} consultation={consultation} />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/pdf.ts lib/docx.ts components/export/ app/resultado/
git commit -m "feat: add PDF/DOCX export and resultado page"
```

---

## Task 13: Final Wiring and Smoke Test

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Update `app/layout.tsx` with base metadata**

```typescript
// app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Anamnese IA',
  description: 'Ferramenta de apoio para estruturação de anamneses médicas',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} bg-gray-50 antialiased`}>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Run all tests**

```bash
npm run test:run
```

Expected: all tests PASS

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Start dev server and smoke test manually**

```bash
npm run dev
```

Manual checks:
1. Open `http://localhost:3000` → should redirect to `/pacientes`
2. Create a new patient → should redirect to `/atendimento/[id]`
3. Walk through all 5 steps using mock AI
4. On step 5 (anamnese), click "Salvar e exportar" → should redirect to `/resultado/[id]`
5. Click "Exportar PDF" → should download a PDF file
6. Click "Exportar DOCX" → should download a DOCX file

- [ ] **Step 5: Final commit**

```bash
git add app/layout.tsx
git commit -m "feat: complete Anamnese IA core system — mock mode ready for testing"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| Upload de arquivo de áudio | Task 10 — StepAudio |
| Sem armazenar áudio | Task 6 — API Routes (processa em memória) |
| Seleção/cadastro de paciente | Task 10 — StepPatient, Task 11 — /pacientes/novo |
| Confirmação de responsabilidade | Task 10 — StepResponsibility |
| Transcrição bruta exibida | Task 10 — StepSections |
| Seleção/remoção/adição de seções SOAP | Task 10 — StepSections |
| Geração da anamnese estruturada | Task 10 — StepSections → API |
| Edição da anamnese final | Task 10 — StepAnamnesis |
| Exportação PDF com cabeçalho médico+paciente | Task 12 — lib/pdf.ts |
| Exportação DOCX com cabeçalho médico+paciente | Task 12 — lib/docx.ts |
| localStorage como DB local | Task 4 — lib/db.ts |
| Abstração para migrar ao Supabase | Task 4 — lib/db.ts (PatientRepository/ConsultationRepository) |
| Mock AI via flag de ambiente | Task 5 — lib/mock/ai.ts + NEXT_PUBLIC_MOCK_AI |
| Design system (Button, Input, etc.) | Task 7 |
| Context/Provider sem prop drilling | Task 9 — ConsultationContext |
| Hooks reutilizáveis | Task 8 — usePatients, useConsultation |
| TypeScript estrito, tipos centralizados | Task 2 — types/index.ts |
| Responsividade mobile-first | Tailwind em todos os componentes |
| Acessibilidade (labels, semântica) | Todos os componentes UI |

**Placeholder scan:** nenhum TBD, TODO ou "similar ao task N" encontrado.

**Type consistency:** todos os tipos (`Patient`, `Consultation`, `Section`, `StructuredAnamnesis`, `ConsultationFlowState`) definidos em `types/index.ts` e usados consistentemente em todos os tasks.
