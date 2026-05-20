# Patient Table View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current patient list (`<ul>`) on `/consultation` with a shadcn `Table` showing: Nome completo, Data de nascimento, Último atendimento, and Ações (hybrid: "Iniciar atendimento" button + `⋯` dropdown with Editar, Excluir, Ver última anamnese).

**Architecture:** `PatientWithStats` needs a `lastConsultationAt?: string` field fetched server-side via Supabase join (alongside the existing `consultationCount`). The table is a pure UI refactor of `ConsultationPageClient` — no new API routes needed. Mobile: secondary columns hidden on small screens.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · shadcn/ui Table · Tailwind CSS · Vitest + RTL

---

## Context from previous session

All these components already exist and are tested:
- `src/components/consultation/edit-patient-sheet.tsx` — Edit via AppSheet + PATCH
- `src/components/consultation/delete-patient-dialog.tsx` — AlertDialog, count from props
- `src/components/consultation/last-anamnesis-sheet.tsx` — Lazy fetch on open
- `src/components/consultation/patient-row-actions.tsx` — DropdownMenu (Editar + Excluir)
- `src/types/index.ts` — `PatientWithStats { consultationCount: number }`
- `src/server/repositories/db.ts` — `PatientRepository.findAllWithStats`

## File Map

| Action | File |
|---|---|
| Modify | `src/types/index.ts` — add `lastConsultationAt?: string` to `PatientWithStats` |
| Modify | `src/server/repositories/db.ts` — update `findAllWithStats` to also select latest `consultations.created_at` |
| Modify | `src/components/consultation/patient-row-actions.tsx` — add "Ver última anamnese" item to dropdown |
| Modify | `src/components/consultation/consultation-page-client.tsx` — replace `<ul>` with shadcn `Table` |
| Install | shadcn `Table` component if not present (`npx shadcn@latest add table`) |

---

## Task 1: Extend `PatientWithStats` with `lastConsultationAt`

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/server/repositories/db.ts`

- [ ] **Step 1: Update `PatientWithStats` in `src/types/index.ts`**

```ts
export interface PatientWithStats extends Patient {
  consultationCount: number
  lastConsultationAt?: string  // ISO datetime of most recent consultation
}
```

- [ ] **Step 2: Update `findAllWithStats` in `src/server/repositories/db.ts`**

The current query is:
```ts
.select('*, consultations(count)')
```

Change to also fetch the latest consultation date. Supabase supports selecting nested columns alongside aggregates:

```ts
async findAllWithStats(userId: string): Promise<PatientWithStats[]> {
  const { data } = await supabase
    .from('patients')
    .select('*, consultations(count, created_at)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return (data ?? []).map((row) => {
    const consultations = row.consultations as { count: number; created_at: string }[]
    const sorted = [...consultations].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    return {
      ...toPatient(row),
      consultationCount: consultations[0]?.count ?? 0,
      lastConsultationAt: sorted[0]?.created_at ?? undefined,
    }
  })
},
```

> **Note on Supabase embedded count + columns:** If Supabase returns `count` as a separate aggregate and `created_at` rows separately, you may need two queries or a different approach. Alternative: use `findAllWithStats` to do count only, then in `page.tsx` do a second query `ConsultationRepository.findLatestDates(userId)` returning `{ patientId, createdAt }[]` and merge. Test both approaches and use whichever works.

- [ ] **Step 3: Run all tests**

```bash
cd "d:/REPOS-GITHUB-PARTICULAR/project-anamnese-ia-claude-code-repo-local" && npm test -- --run
```

Expected: same pass count (98 passing, 5 pre-existing failures).

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/server/repositories/db.ts
git commit -m "feat: add lastConsultationAt to PatientWithStats"
```

---

## Task 2: Add "Ver última anamnese" to `PatientRowActions` dropdown

**Files:**
- Modify: `src/components/consultation/patient-row-actions.tsx`

Currently the dropdown only has Editar + Excluir. Add "Ver última anamnese" as a third item (visible only when `patient.consultationCount > 0`).

- [ ] **Step 1: Update `PatientRowActionsProps` interface**

Add `onViewAnamnesis: () => void` to the interface:

```ts
interface PatientRowActionsProps {
  patient: PatientWithStats
  onUpdated: (updated: PatientWithStats) => void
  onDeleted: (id: string) => void
  onViewAnamnesis: () => void
}
```

- [ ] **Step 2: Add "Ver última anamnese" menu item**

Add import `FileText` from lucide-react. Add the item before the separator before Excluir:

```tsx
{patient.consultationCount > 0 && (
  <>
    <DropdownMenuItem onClick={onViewAnamnesis}>
      <FileText className="h-3.5 w-3.5 mr-2" />
      Ver última anamnese
    </DropdownMenuItem>
    <DropdownMenuSeparator />
  </>
)}
```

Remove the `EditPatientSheet` and `DeletePatientDialog` from inside `PatientRowActions` — they stay in `ConsultationPageClient` where state is managed. The dropdown just calls callbacks.

Wait — actually keep current design (sheets inside PatientRowActions) to avoid prop drilling. Just add `onViewAnamnesis` as a callback since the `LastAnamnesisSheet` state lives in `ConsultationPageClient`.

- [ ] **Step 3: Run tests**

```bash
cd "d:/REPOS-GITHUB-PARTICULAR/project-anamnese-ia-claude-code-repo-local" && npm test -- --run 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add src/components/consultation/patient-row-actions.tsx
git commit -m "feat: add Ver última anamnese to PatientRowActions dropdown"
```

---

## Task 3: Replace patient list with shadcn Table

**Files:**
- Modify: `src/components/consultation/consultation-page-client.tsx`
- Possibly install: `src/components/ui/table.tsx` (if not present)

- [ ] **Step 1: Check if Table component exists**

```bash
ls "d:/REPOS-GITHUB-PARTICULAR/project-anamnese-ia-claude-code-repo-local/src/components/ui/table.tsx" 2>/dev/null && echo "exists" || echo "missing"
```

If missing:
```bash
cd "d:/REPOS-GITHUB-PARTICULAR/project-anamnese-ia-claude-code-repo-local" && npx shadcn@latest add table --yes
```

- [ ] **Step 2: Update `ConsultationPageClient`**

Replace the `<ul>` block with a shadcn Table. Keep the empty state as-is. The new structure:

```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
```

Table columns:
- **Nome completo** — `patient.name` (always visible)
- **CPF** — `patient.cpf` (hidden on mobile: `hidden sm:table-cell`)
- **Data de nascimento** — `patient.birthDate` formatted as `dd/MM/yyyy`, or "—" if absent (hidden on mobile)
- **Último atendimento** — `patient.lastConsultationAt` formatted as `dd/MM/yyyy`, or "Nunca" (hidden on mobile)
- **Ações** — hybrid: `<Button size="sm">Iniciar atendimento</Button>` + `<PatientRowActions ... />`

Full replacement for the list block:

```tsx
{patients.length === 0 ? (
  /* ...existing empty state unchanged... */
) : (
  <div className="rounded-xl border border-border overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent border-border">
          <TableHead>Nome completo</TableHead>
          <TableHead className="hidden sm:table-cell">Data de nascimento</TableHead>
          <TableHead className="hidden sm:table-cell">Último atendimento</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {patients.map((patient) => (
          <TableRow key={patient.id} className="border-border hover:bg-white/[0.02]">
            <TableCell>
              <p className="text-sm font-medium text-foreground">{patient.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5 sm:hidden">{patient.cpf}</p>
            </TableCell>
            <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
              {patient.birthDate ? formatDate(patient.birthDate) : '—'}
            </TableCell>
            <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
              {patient.lastConsultationAt ? formatDate(patient.lastConsultationAt) : 'Nunca'}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" size="sm">
                  Iniciar atendimento
                </Button>
                <PatientRowActions
                  patient={patient}
                  onUpdated={handlePatientUpdated}
                  onDeleted={handlePatientDeleted}
                  onViewAnamnesis={() => setAnamnesisPatient(patient)}
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
)}
```

Add `formatDate` helper at top of file:
```ts
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
```

- [ ] **Step 3: Run all tests and build check**

```bash
cd "d:/REPOS-GITHUB-PARTICULAR/project-anamnese-ia-claude-code-repo-local" && npm test -- --run 2>&1 | tail -10
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/components/consultation/consultation-page-client.tsx src/components/ui/table.tsx
git commit -m "feat: replace patient list with shadcn Table (nome, nascimento, último atendimento, ações)"
```

---

## Final verification

- [ ] Run full test suite: `npm test -- --run` — all 98+ passing
- [ ] Build: `npm run build` — no errors
- [ ] Manual: open `/consultation`, confirm table renders with all columns, hybrid actions work
