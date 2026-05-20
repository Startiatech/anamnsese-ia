# Patient Row Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-patient actions (edit, delete with confirmation, start consultation, view last anamnesis) to the `/consultation` page patient list.

**Architecture:** Consultation counts are fetched server-side via Supabase embedded count so they are available at render time — no async on delete click. The edit form reuses `AppSheet`. The delete dialog uses shadcn `AlertDialog` and shows the consultation count already in state. "View last anamnesis" lazily fetches on click and displays in a read-only `AppSheet`. Row actions live in a `DropdownMenu` (`⋯` button).

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · shadcn/ui (DropdownMenu, AlertDialog) · Supabase service_role · Vitest + RTL

---

## File Map

| Action | File |
|---|---|
| Modify | `src/types/index.ts` — add `PatientWithStats` |
| Modify | `src/server/repositories/db.ts` — add `findAllWithStats`, `update`, `delete` to PatientRepository; add `findLatestByPatientId` to ConsultationRepository |
| Modify | `src/app/api/patients/[id]/route.ts` — add PATCH + DELETE handlers |
| Create | `src/app/api/patients/[id]/latest-consultation/route.ts` — GET latest consultation for a patient |
| Create | `src/components/consultation/edit-patient-sheet.tsx` |
| Create | `src/components/consultation/delete-patient-dialog.tsx` |
| Create | `src/components/consultation/last-anamnesis-sheet.tsx` |
| Create | `src/components/consultation/patient-row-actions.tsx` |
| Modify | `src/app/(app)/consultation/page.tsx` — use `findAllWithStats` |
| Modify | `src/components/consultation/consultation-page-client.tsx` — wire up all actions |
| Create | `src/app/api/patients/[id]/route.test.ts` — PATCH + DELETE tests |
| Create | `src/components/consultation/edit-patient-sheet.test.tsx` |
| Create | `src/components/consultation/delete-patient-dialog.test.tsx` |
| Create | `src/components/consultation/last-anamnesis-sheet.test.tsx` |

---

## Task 1: Add `PatientWithStats` type and update repository

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/server/repositories/db.ts`

- [ ] **Step 1: Add `PatientWithStats` to types**

In `src/types/index.ts`, after the `Patient` interface add:

```ts
export interface PatientWithStats extends Patient {
  consultationCount: number
}
```

- [ ] **Step 2: Add `findAllWithStats` to PatientRepository**

In `src/server/repositories/db.ts`, add after the existing `findByCPF`:

```ts
async findAllWithStats(userId: string): Promise<PatientWithStats[]> {
  const { data } = await supabase
    .from('patients')
    .select('*, consultations(count)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return (data ?? []).map((row) => ({
    ...toPatient(row as Record<string, string>),
    consultationCount: (row.consultations as { count: number }[])[0]?.count ?? 0,
  }))
},
```

Also update the import at top of `db.ts` to include `PatientWithStats`:

```ts
import type { Patient, PatientWithStats, Consultation, StructuredAnamnesis } from '@/types'
```

- [ ] **Step 3: Add `update` and `delete` to PatientRepository**

In `src/server/repositories/db.ts`, inside `PatientRepository`, after `save`:

```ts
async update(userId: string, id: string, data: Partial<Pick<Patient, 'name' | 'cpf' | 'birthDate' | 'phone'>>): Promise<void> {
  await supabase
    .from('patients')
    .update({
      name: data.name,
      cpf: data.cpf,
      birth_date: data.birthDate ?? null,
      phone: data.phone ?? null,
    })
    .eq('user_id', userId)
    .eq('id', id)
},

async delete(userId: string, id: string): Promise<void> {
  await supabase
    .from('patients')
    .delete()
    .eq('user_id', userId)
    .eq('id', id)
},
```

- [ ] **Step 4: Add `findLatestByPatientId` to ConsultationRepository**

Rename the existing `findByPatientId` method to `findLatestByPatientId` for clarity (it already returns only the most recent one):

```ts
async findLatestByPatientId(userId: string, patientId: string): Promise<Consultation | null> {
  const { data } = await supabase
    .from('consultations')
    .select('*')
    .eq('user_id', userId)
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  return data ? toConsultation(data) : null
},
```

Keep `findByPatientId` as an alias pointing to `findLatestByPatientId` so existing callers don't break:

```ts
findByPatientId(userId: string, patientId: string): Promise<Consultation | null> {
  return ConsultationRepository.findLatestByPatientId(userId, patientId)
},
```

- [ ] **Step 5: Run tests to confirm nothing broken**

```bash
npm test -- --run
```

Expected: all existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/server/repositories/db.ts
git commit -m "feat: add PatientWithStats, findAllWithStats, patient update/delete, findLatestByPatientId"
```

---

## Task 2: API — PATCH and DELETE `/api/patients/[id]`

**Files:**
- Modify: `src/app/api/patients/[id]/route.ts`
- Create: `src/app/api/patients/[id]/route.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/app/api/patients/[id]/route.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetServerUser, mockUpdate, mockDelete, mockEq, mockFrom } = vi.hoisted(() => ({
  mockGetServerUser: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockEq: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => ({
      json: async () => data,
      status: init?.status ?? 200,
    }),
  },
  NextRequest: class {},
}))

vi.mock('@/server/services/session', () => ({ getServerUser: mockGetServerUser }))

vi.mock('@/server/repositories/db', () => ({
  PatientRepository: {
    findById: vi.fn(),
    update: mockUpdate,
    delete: mockDelete,
  },
}))

import { PATCH, DELETE } from './route'

function makeRequest(body: object) {
  return { json: async () => body } as never
}
const params = Promise.resolve({ id: 'patient-1' })

describe('PATCH /api/patients/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetServerUser.mockResolvedValue({ sub: 'user-1' })
    mockUpdate.mockResolvedValue(undefined)
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetServerUser.mockResolvedValue(null)
    const res = await PATCH(makeRequest({}), { params })
    expect(res.status).toBe(401)
  })

  it('calls PatientRepository.update with correct args and returns ok', async () => {
    const body = { name: 'Dr. Ana', cpf: '123.456.789-00', birthDate: '1990-01-01', phone: '11999' }
    const res = await PATCH(makeRequest(body), { params })
    const json = await res.json()
    expect(mockUpdate).toHaveBeenCalledWith('user-1', 'patient-1', body)
    expect(json).toEqual({ ok: true })
  })
})

describe('DELETE /api/patients/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetServerUser.mockResolvedValue({ sub: 'user-1' })
    mockDelete.mockResolvedValue(undefined)
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetServerUser.mockResolvedValue(null)
    const res = await DELETE({} as never, { params })
    expect(res.status).toBe(401)
  })

  it('calls PatientRepository.delete with correct args and returns ok', async () => {
    const res = await DELETE({} as never, { params })
    const json = await res.json()
    expect(mockDelete).toHaveBeenCalledWith('user-1', 'patient-1')
    expect(json).toEqual({ ok: true })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/app/api/patients/\\[id\\]/route.test.ts --run
```

Expected: FAIL — `PATCH` and `DELETE` not exported.

- [ ] **Step 3: Implement PATCH and DELETE in the route**

Replace the contents of `src/app/api/patients/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/server/services/session'
import { PatientRepository } from '@/server/repositories/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const patient = await PatientRepository.findById(user.id, id)
  if (!patient) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(patient)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  await PatientRepository.update(user.id, id, body)
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await PatientRepository.delete(user.id, id)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/app/api/patients/\\[id\\]/route.test.ts --run
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/patients/\[id\]/route.ts src/app/api/patients/\[id\]/route.test.ts
git commit -m "feat: add PATCH and DELETE to /api/patients/[id]"
```

---

## Task 3: API — GET `/api/patients/[id]/latest-consultation`

**Files:**
- Create: `src/app/api/patients/[id]/latest-consultation/route.ts`

- [ ] **Step 1: Create the route**

Create `src/app/api/patients/[id]/latest-consultation/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/server/services/session'
import { ConsultationRepository } from '@/server/repositories/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const consultation = await ConsultationRepository.findLatestByPatientId(user.id, id)
  if (!consultation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(consultation)
}
```

- [ ] **Step 2: Add `patientLatestConsultation` to `API` in `src/lib/routes.ts`**

Inside the `API` object, after `patientId`:

```ts
patientLatestConsultation: (id: string) => `/api/patients/${id}/latest-consultation`,
```

- [ ] **Step 3: Run tests**

```bash
npm test -- --run
```

Expected: all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/patients/\[id\]/latest-consultation/route.ts src/lib/routes.ts
git commit -m "feat: add GET /api/patients/[id]/latest-consultation"
```

---

## Task 4: `EditPatientSheet` component

**Files:**
- Create: `src/components/consultation/edit-patient-sheet.tsx`
- Create: `src/components/consultation/edit-patient-sheet.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/consultation/edit-patient-sheet.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditPatientSheet } from './edit-patient-sheet'
import type { PatientWithStats } from '@/types'

vi.mock('sonner', () => ({
  toast: { promise: vi.fn() },
}))

vi.mock('@/lib/routes', () => ({
  API: { patientId: (id: string) => `/api/patients/${id}` },
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

const patient: PatientWithStats = {
  id: 'p-1',
  name: 'Ana Lima',
  cpf: '123.456.789-00',
  createdAt: '2024-01-01T00:00:00Z',
  consultationCount: 2,
}

describe('EditPatientSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
  })

  it('renders patient name in title and prefills name field', () => {
    render(
      <EditPatientSheet
        open={true}
        onOpenChange={vi.fn()}
        patient={patient}
        onSuccess={vi.fn()}
      />
    )
    expect(screen.getByDisplayValue('Ana Lima')).toBeInTheDocument()
  })

  it('calls PATCH with correct payload on submit', async () => {
    const onSuccess = vi.fn()
    render(
      <EditPatientSheet
        open={true}
        onOpenChange={vi.fn()}
        patient={patient}
        onSuccess={onSuccess}
      />
    )
    fireEvent.submit(screen.getByRole('form'))
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/patients/p-1',
        expect.objectContaining({ method: 'PATCH' }),
      )
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/components/consultation/edit-patient-sheet.test.tsx --run
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `EditPatientSheet`**

Create `src/components/consultation/edit-patient-sheet.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { UserPen } from 'lucide-react'
import { formatCPF } from '@/lib/utils'
import { patientSchema, type PatientFormData } from '@/lib/schemas'
import { API } from '@/lib/routes'
import { Input } from '@/components/ui/input'
import { FormLabel } from '@/components/ui/form-label'
import { AppSheet } from '@/components/ui/app-sheet'
import type { PatientWithStats } from '@/types'

interface EditPatientSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patient: PatientWithStats
  onSuccess: (updated: PatientWithStats) => void
}

const FORM_ID = 'edit-patient-form'

export function EditPatientSheet({ open, onOpenChange, patient, onSuccess }: EditPatientSheetProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    mode: 'onTouched',
  })

  useEffect(() => {
    if (open) {
      reset({
        name: patient.name,
        cpf: patient.cpf,
        birthDate: patient.birthDate ?? '',
        phone: patient.phone ?? '',
      })
    }
  }, [open, patient, reset])

  const cpfValue = watch('cpf') ?? ''

  async function onSubmit(data: PatientFormData) {
    const promise = fetch(API.patientId(patient.id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(async (res) => {
      if (!res.ok) throw new Error('Erro ao atualizar paciente')
      return res.json()
    })

    toast.promise(promise, {
      loading: 'Aguarde...',
      success: 'Paciente atualizado!',
      error: 'Erro ao atualizar paciente.',
    })

    await promise.catch(() => null).then((result) => {
      if (!result) return
      onOpenChange(false)
      onSuccess({ ...patient, ...data })
    })
  }

  return (
    <AppSheet
      open={open}
      onOpenChange={onOpenChange}
      onCancel={() => reset()}
      title="Editar Paciente"
      description={`Altere os dados de ${patient.name}.`}
      icon={<UserPen className="h-4 w-4 text-violet-400" />}
      formId={FORM_ID}
      submitLabel="Salvar alterações"
      submitDisabled={isSubmitting}
    >
      <form id={FORM_ID} role="form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-1">
          <FormLabel htmlFor="ep-name" required>Nome completo</FormLabel>
          <Input id="ep-name" {...register('name')} autoFocus />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-1">
          <FormLabel htmlFor="ep-cpf" required>CPF</FormLabel>
          <Input
            id="ep-cpf"
            placeholder="000.000.000-00"
            maxLength={14}
            name="cpf"
            ref={register('cpf').ref}
            onBlur={register('cpf').onBlur}
            value={cpfValue}
            onChange={e => setValue('cpf', formatCPF(e.target.value), { shouldValidate: true })}
          />
          {errors.cpf && <p className="text-xs text-destructive">{errors.cpf.message}</p>}
        </div>

        <div className="space-y-1">
          <FormLabel htmlFor="ep-birthDate">Data de nascimento</FormLabel>
          <Input id="ep-birthDate" type="date" {...register('birthDate')} />
        </div>

        <div className="space-y-1">
          <FormLabel htmlFor="ep-phone">Telefone</FormLabel>
          <Input id="ep-phone" placeholder="(00) 00000-0000" {...register('phone')} />
        </div>
      </form>
    </AppSheet>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/components/consultation/edit-patient-sheet.test.tsx --run
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/consultation/edit-patient-sheet.tsx src/components/consultation/edit-patient-sheet.test.tsx
git commit -m "feat: add EditPatientSheet component"
```

---

## Task 5: `DeletePatientDialog` component

**Files:**
- Create: `src/components/consultation/delete-patient-dialog.tsx`
- Create: `src/components/consultation/delete-patient-dialog.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/consultation/delete-patient-dialog.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DeletePatientDialog } from './delete-patient-dialog'
import type { PatientWithStats } from '@/types'

vi.mock('sonner', () => ({
  toast: { promise: vi.fn() },
}))

vi.mock('@/lib/routes', () => ({
  API: { patientId: (id: string) => `/api/patients/${id}` },
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

function makePatient(consultationCount: number): PatientWithStats {
  return {
    id: 'p-1',
    name: 'Ana Lima',
    cpf: '123.456.789-00',
    createdAt: '2024-01-01T00:00:00Z',
    consultationCount,
  }
}

describe('DeletePatientDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
  })

  it('shows simple message when patient has no consultations', () => {
    render(
      <DeletePatientDialog
        open={true}
        onOpenChange={vi.fn()}
        patient={makePatient(0)}
        onSuccess={vi.fn()}
      />
    )
    expect(screen.getByText(/Esta ação não pode ser desfeita/i)).toBeInTheDocument()
    expect(screen.queryByText(/consulta/i)).not.toBeInTheDocument()
  })

  it('shows consultation count warning when patient has consultations', () => {
    render(
      <DeletePatientDialog
        open={true}
        onOpenChange={vi.fn()}
        patient={makePatient(3)}
        onSuccess={vi.fn()}
      />
    )
    expect(screen.getByText(/3 consulta/i)).toBeInTheDocument()
  })

  it('calls DELETE and invokes onSuccess', async () => {
    const onSuccess = vi.fn()
    render(
      <DeletePatientDialog
        open={true}
        onOpenChange={vi.fn()}
        patient={makePatient(0)}
        onSuccess={onSuccess}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /excluir/i }))
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/patients/p-1',
        expect.objectContaining({ method: 'DELETE' }),
      )
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/components/consultation/delete-patient-dialog.test.tsx --run
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `DeletePatientDialog`**

Create `src/components/consultation/delete-patient-dialog.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { API } from '@/lib/routes'
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
import type { PatientWithStats } from '@/types'

interface DeletePatientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patient: PatientWithStats
  onSuccess: (id: string) => void
}

export function DeletePatientDialog({ open, onOpenChange, patient, onSuccess }: DeletePatientDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const hasConsultations = patient.consultationCount > 0
  const count = patient.consultationCount

  async function handleDelete() {
    setIsDeleting(true)
    const promise = fetch(API.patientId(patient.id), { method: 'DELETE' }).then(async (res) => {
      if (!res.ok) throw new Error('Erro ao excluir paciente')
      return res.json()
    })

    toast.promise(promise, {
      loading: 'Aguarde...',
      success: 'Paciente excluído.',
      error: 'Erro ao excluir paciente.',
    })

    await promise
      .then(() => {
        onOpenChange(false)
        onSuccess(patient.id)
      })
      .catch(() => null)
      .finally(() => setIsDeleting(false))
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir {patient.name}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              {hasConsultations ? (
                <>
                  <p>
                    Este paciente possui{' '}
                    <span className="font-semibold text-foreground">
                      {count} consulta{count !== 1 ? 's' : ''} registrada{count !== 1 ? 's' : ''}
                    </span>
                    . Ao excluir, todos os registros vinculados serão perdidos permanentemente.
                  </p>
                  <p className="text-destructive font-medium">Esta ação não pode ser desfeita.</p>
                </>
              ) : (
                <p>Esta ação não pode ser desfeita.</p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/components/consultation/delete-patient-dialog.test.tsx --run
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/consultation/delete-patient-dialog.tsx src/components/consultation/delete-patient-dialog.test.tsx
git commit -m "feat: add DeletePatientDialog with consultation count warning"
```

---

## Task 6: `LastAnamnesisSheet` component

**Files:**
- Create: `src/components/consultation/last-anamnesis-sheet.tsx`
- Create: `src/components/consultation/last-anamnesis-sheet.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/consultation/last-anamnesis-sheet.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { LastAnamnesisSheet } from './last-anamnesis-sheet'
import type { PatientWithStats, Consultation } from '@/types'

vi.mock('@/lib/routes', () => ({
  API: { patientLatestConsultation: (id: string) => `/api/patients/${id}/latest-consultation` },
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

const patient: PatientWithStats = {
  id: 'p-1',
  name: 'Ana Lima',
  cpf: '123.456.789-00',
  createdAt: '2024-01-01T00:00:00Z',
  consultationCount: 1,
}

const consultation: Consultation = {
  id: 'c-1',
  patientId: 'p-1',
  rawTranscript: '',
  structuredAnamnesis: {
    sections: [{ title: 'Subjetivo (S)', content: 'Dor de cabeça há 2 dias.' }],
  },
  createdAt: '2024-03-01T10:00:00Z',
  updatedAt: '2024-03-01T10:00:00Z',
}

describe('LastAnamnesisSheet', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches and displays anamnesis sections when open', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => consultation })
    render(<LastAnamnesisSheet open={true} onOpenChange={vi.fn()} patient={patient} />)
    await waitFor(() => {
      expect(screen.getByText('Subjetivo (S)')).toBeInTheDocument()
      expect(screen.getByText('Dor de cabeça há 2 dias.')).toBeInTheDocument()
    })
  })

  it('shows empty state when fetch returns 404', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 })
    render(<LastAnamnesisSheet open={true} onOpenChange={vi.fn()} patient={patient} />)
    await waitFor(() => {
      expect(screen.getByText(/nenhuma anamnese/i)).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/components/consultation/last-anamnesis-sheet.test.tsx --run
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `LastAnamnesisSheet`**

Create `src/components/consultation/last-anamnesis-sheet.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import { API } from '@/lib/routes'
import { AppSheet } from '@/components/ui/app-sheet'
import type { Consultation, PatientWithStats } from '@/types'

interface LastAnamnesisSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patient: PatientWithStats
}

export function LastAnamnesisSheet({ open, onOpenChange, patient }: LastAnamnesisSheetProps) {
  const [consultation, setConsultation] = useState<Consultation | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch(API.patientLatestConsultation(patient.id))
      .then(async (res) => {
        if (!res.ok) { setConsultation(null); return }
        setConsultation(await res.json())
      })
      .catch(() => setConsultation(null))
      .finally(() => setLoading(false))
  }, [open, patient.id])

  return (
    <AppSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Última anamnese — ${patient.name}`}
      description="Resultado da última consulta registrada."
      icon={<FileText className="h-4 w-4 text-violet-400" />}
      hideFooter
    >
      {loading && (
        <p className="text-sm text-muted-foreground animate-pulse">Carregando...</p>
      )}

      {!loading && !consultation && (
        <p className="text-sm text-muted-foreground">Nenhuma anamnese encontrada para este paciente.</p>
      )}

      {!loading && consultation && (
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

- [ ] **Step 4: Check if `AppSheet` supports `hideFooter` prop — if not, add it**

Read `src/components/ui/app-sheet.tsx` and check the props interface. If `hideFooter` doesn't exist, add it:

```ts
hideFooter?: boolean
```

And in the JSX, wrap the footer render in `{!hideFooter && (...)}`.

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- src/components/consultation/last-anamnesis-sheet.test.tsx --run
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/consultation/last-anamnesis-sheet.tsx src/components/consultation/last-anamnesis-sheet.test.tsx src/components/ui/app-sheet.tsx
git commit -m "feat: add LastAnamnesisSheet component"
```

---

## Task 7: `PatientRowActions` dropdown

**Files:**
- Create: `src/components/consultation/patient-row-actions.tsx`

No isolated unit tests — this is a thin composition component that wires the three dialogs together. It is covered by integration behavior through the individual component tests.

- [ ] **Step 1: Create `PatientRowActions`**

Create `src/components/consultation/patient-row-actions.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { EditPatientSheet } from './edit-patient-sheet'
import { DeletePatientDialog } from './delete-patient-dialog'
import type { PatientWithStats } from '@/types'

interface PatientRowActionsProps {
  patient: PatientWithStats
  onUpdated: (updated: PatientWithStats) => void
  onDeleted: (id: string) => void
}

export function PatientRowActions({ patient, onUpdated, onDeleted }: PatientRowActionsProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Ações</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5 mr-2" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditPatientSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        patient={patient}
        onSuccess={onUpdated}
      />

      <DeletePatientDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        patient={patient}
        onSuccess={onDeleted}
      />
    </>
  )
}
```

- [ ] **Step 2: Run all tests**

```bash
npm test -- --run
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/consultation/patient-row-actions.tsx
git commit -m "feat: add PatientRowActions dropdown (edit + delete)"
```

---

## Task 8: Wire everything into the consultation page

**Files:**
- Modify: `src/app/(app)/consultation/page.tsx`
- Modify: `src/components/consultation/consultation-page-client.tsx`

- [ ] **Step 1: Update `consultation/page.tsx` to use `findAllWithStats`**

Replace the contents of `src/app/(app)/consultation/page.tsx`:

```ts
import { redirect } from 'next/navigation'
import { getServerUser } from '@/server/services/session'
import { PatientRepository } from '@/server/repositories/db'
import { ROUTES } from '@/lib/routes'
import { ConsultationPageClient } from '@/components/consultation/consultation-page-client'

export const dynamic = 'force-dynamic'

export default async function AtendimentoPage() {
  const user = await getServerUser()
  if (!user) redirect(ROUTES.login)

  const patients = await PatientRepository.findAllWithStats(user.sub)

  return <ConsultationPageClient initialPatients={patients} />
}
```

- [ ] **Step 2: Update `ConsultationPageClient` to use `PatientWithStats` and wire actions**

Replace the contents of `src/components/consultation/consultation-page-client.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Users, FileText } from 'lucide-react'
import { PageHeader } from '@/components/console/page-header'
import { NewPatientSheet } from './new-patient-sheet'
import { PatientRowActions } from './patient-row-actions'
import { LastAnamnesisSheet } from './last-anamnesis-sheet'
import { Button } from '@/components/ui/button'
import type { PatientWithStats } from '@/types'

interface ConsultationPageClientProps {
  initialPatients: PatientWithStats[]
}

export function ConsultationPageClient({ initialPatients }: ConsultationPageClientProps) {
  const [patients, setPatients] = useState<PatientWithStats[]>(initialPatients)
  const [newSheetOpen, setNewSheetOpen] = useState(false)
  const [anamnesisPatient, setAnamnesisPatient] = useState<PatientWithStats | null>(null)

  function handlePatientCreated(patient: PatientWithStats) {
    setPatients(prev => [{ ...patient, consultationCount: 0 }, ...prev])
  }

  function handlePatientUpdated(updated: PatientWithStats) {
    setPatients(prev => prev.map(p => p.id === updated.id ? updated : p))
  }

  function handlePatientDeleted(id: string) {
    setPatients(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Atendimento"
        description="Selecione um paciente para iniciar ou visualize os atendimentos."
        action={<Button size="lg" onClick={() => setNewSheetOpen(true)}>+ Novo paciente</Button>}
      />

      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Pacientes</h2>

        <div
          className="rounded-xl border border-border overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.02)' }}
        >
          {patients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'rgba(124,58,237,0.10)', border: '1px solid rgba(124,58,237,0.22)' }}
              >
                <Users className="h-6 w-6 text-violet-400" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">Nenhum paciente cadastrado</p>
              <p className="text-xs text-muted-foreground mb-5">
                Cadastre seu primeiro paciente para começar os atendimentos.
              </p>
              <Button variant="outline" onClick={() => setNewSheetOpen(true)}>
                + Cadastrar primeiro paciente
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {patients.map((patient) => (
                <li
                  key={patient.id}
                  className="flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{patient.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{patient.cpf}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {patient.consultationCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground gap-1.5"
                        onClick={() => setAnamnesisPatient(patient)}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Ver anamnese
                      </Button>
                    )}

                    <Button variant="outline" size="sm">
                      Iniciar atendimento
                    </Button>

                    <PatientRowActions
                      patient={patient}
                      onUpdated={handlePatientUpdated}
                      onDeleted={handlePatientDeleted}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <NewPatientSheet
        open={newSheetOpen}
        onOpenChange={setNewSheetOpen}
        onSuccess={handlePatientCreated}
      />

      {anamnesisPatient && (
        <LastAnamnesisSheet
          open={!!anamnesisPatient}
          onOpenChange={(open) => { if (!open) setAnamnesisPatient(null) }}
          patient={anamnesisPatient}
        />
      )}
    </div>
  )
}
```

Note: `NewPatientSheet.onSuccess` receives a `Patient` (from the POST response) — cast it with `consultationCount: 0` as shown above. If needed, update `NewPatientSheet`'s `onSuccess` prop type to accept `Patient` (the existing type) since the API doesn't return `consultationCount`.

- [ ] **Step 3: Fix `NewPatientSheet` onSuccess type if TypeScript complains**

In `src/components/consultation/new-patient-sheet.tsx`, the `onSuccess` prop is typed as `(patient: Patient) => void`. The `handlePatientCreated` function receives a `Patient` and adds `consultationCount: 0`. This is fine — no change needed unless TypeScript errors appear.

- [ ] **Step 4: Run all tests**

```bash
npm test -- --run
```

Expected: all tests PASS.

- [ ] **Step 5: Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors, successful build.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/consultation/page.tsx src/components/consultation/consultation-page-client.tsx
git commit -m "feat: wire patient row actions into consultation page"
```

---

## Final verification

- [ ] Run full test suite: `npm test -- --run` — all pass
- [ ] Check build: `npm run build` — no errors
- [ ] Manual smoke: open `/consultation`, verify patient list loads with consultation counts, test edit/delete/ver anamnese flows
