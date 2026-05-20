# User Management (Edit / Delete / Block) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add edit, delete, and block/unblock actions to `/console/users`, with 3-state status badge (onboarding / ativo / bloqueado) and a `/suspended` page for blocked users.

**Architecture:** Add `blocked` boolean column to `users` table → expose it in `StoredUser` → two new admin API routes (PATCH/DELETE) → layout guard redirects blocked users to `/suspended` → `UsersClient` gains action buttons per row.

**Tech Stack:** Next.js App Router · Supabase (service_role) · React Hook Form · Sonner toast.promise · Vitest

---

## File Map

| Action | File |
|---|---|
| Modify | `src/server/repositories/users.ts` — add `blocked`, `updateUser`, `deleteUser` |
| Modify | `src/lib/users.ts` — re-export new functions |
| Modify | `src/lib/users.test.ts` — tests for new functions |
| Create | `src/app/api/admin/users/[id]/route.ts` — PATCH + DELETE |
| Modify | `src/app/(app)/layout.tsx` — redirect blocked → /suspended |
| Create | `src/app/(app)/suspended/page.tsx` — acesso suspenso screen |
| Modify | `src/app/(admin)/console/users/page.tsx` — pass status to UserRow |
| Modify | `src/app/(admin)/console/users/users-client.tsx` — edit/delete/block UI |

---

## Task 1: Add `blocked` to Supabase + repository

**Files:**
- Modify: `src/server/repositories/users.ts`

- [ ] **Step 1: Apply migration in Supabase**

Run in Supabase SQL editor or via MCP:
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked boolean NOT NULL DEFAULT false;
```

- [ ] **Step 2: Write failing tests**

In `src/lib/users.test.ts`, add after the existing `listUsers` describe block:

```ts
// ─── updateUser ──────────────────────────────────────────────────────────────

const mockUpdate = vi.fn()

// Add mockUpdate to the supabase mock — replace the vi.mock block at the top:
// supabase: {
//   from: vi.fn(() => ({
//     select: mockSelect.mockReturnThis(),
//     insert: mockInsert.mockReturnThis(),
//     update: mockUpdate.mockReturnThis(),   ← add this line
//     eq: mockEq.mockReturnThis(),
//     order: mockOrder.mockReturnThis(),
//     single: mockSingle,
//   })),
// }

describe('updateUser', () => {
  it('calls supabase update with mapped fields', async () => {
    mockEq.mockResolvedValueOnce({ error: null })
    await updateUser('uuid-1', { name: 'Dr. Nova', specialty: 'Ortopedia', phone: '11999' })
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Dr. Nova', specialty: 'Ortopedia', phone: '11999' })
    )
  })

  it('calls supabase update with blocked flag', async () => {
    mockEq.mockResolvedValueOnce({ error: null })
    await updateUser('uuid-1', { blocked: true })
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ blocked: true }))
  })
})

// ─── deleteUser ───────────────────────────────────────────────────────────────

const mockDelete = vi.fn()

// Also add to mock: delete: mockDelete.mockReturnThis()

describe('deleteUser', () => {
  it('calls supabase delete with correct id', async () => {
    mockEq.mockResolvedValueOnce({ error: null })
    await deleteUser('uuid-1')
    expect(mockDelete).toHaveBeenCalled()
    expect(mockEq).toHaveBeenCalledWith('id', 'uuid-1')
  })
})
```

- [ ] **Step 3: Run tests — expect FAIL**

```bash
npm test -- src/lib/users.test.ts
```

Expected: `updateUser is not a function` / `deleteUser is not a function`

- [ ] **Step 4: Update `src/server/repositories/users.ts`**

Add `blocked` to `StoredUser` interface:
```ts
blocked: boolean
```

Update `toStoredUser`:
```ts
blocked: (row.blocked as boolean) ?? false,
```

Add new functions at the end of the file:
```ts
export async function updateUser(
  id: string,
  data: Partial<Pick<StoredUser, 'name' | 'specialty' | 'phone' | 'blocked'>>
): Promise<void> {
  const update: Record<string, unknown> = {}
  if (data.name !== undefined)      update.name      = data.name
  if (data.specialty !== undefined) update.specialty = data.specialty
  if (data.phone !== undefined)     update.phone     = data.phone
  if (data.blocked !== undefined)   update.blocked   = data.blocked
  await supabase.from('users').update(update).eq('id', id)
}

export async function deleteUser(id: string): Promise<void> {
  await supabase.from('users').delete().eq('id', id)
}
```

- [ ] **Step 5: Update mock in test file**

Replace the `vi.mock` block in `src/lib/users.test.ts` — add `mockUpdate` and `mockDelete` declarations at the top alongside existing mocks, and include them in the mock factory:

```ts
const mockUpdate = vi.fn()
const mockDelete = vi.fn()

vi.mock('@/server/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect.mockReturnThis(),
      insert: mockInsert.mockReturnThis(),
      update: mockUpdate.mockReturnThis(),
      delete: mockDelete.mockReturnThis(),
      eq: mockEq.mockReturnThis(),
      order: mockOrder.mockReturnThis(),
      single: mockSingle,
    })),
  },
}))
```

Also update the import line to include new functions:
```ts
import { findUserByEmail, findUserById, addUser, listUsers, updateUser, deleteUser } from './users'
```

Also update `expectedUser` to include `blocked: false`.

- [ ] **Step 6: Run tests — expect PASS**

```bash
npm test -- src/lib/users.test.ts
```

Expected: all tests pass.

- [ ] **Step 7: Update `src/lib/users.ts` re-exports**

```ts
export { findUserByEmail, findUserById, addUser, listUsers, updateUser, deleteUser } from '@/server/repositories/users'
export type { StoredUser, UserRole } from '@/server/repositories/users'
```

- [ ] **Step 8: Commit**

```bash
git add src/server/repositories/users.ts src/lib/users.ts src/lib/users.test.ts
git commit -m "feat: add blocked field + updateUser/deleteUser to users repository"
```

---

## Task 2: Admin API routes PATCH + DELETE `/api/admin/users/[id]`

**Files:**
- Create: `src/app/api/admin/users/[id]/route.ts`

- [ ] **Step 1: Create the route file**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/server/services/session'
import { updateUser, deleteUser, findUserById } from '@/server/repositories/users'

async function requireAdmin(req: NextRequest) {
  const payload = await getServerUser()
  if (!payload || (payload.role !== 'admin' && payload.role !== 'master')) {
    return null
  }
  return payload
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await requireAdmin(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const user = await findUserById(id)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json()
  const allowed = ['name', 'specialty', 'phone', 'blocked'] as const
  const data: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) data[key] = body[key]
  }

  await updateUser(id, data as Parameters<typeof updateUser>[1])
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await requireAdmin(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const user = await findUserById(id)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  await deleteUser(id)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/admin/users/
git commit -m "feat: add PATCH/DELETE /api/admin/users/[id]"
```

---

## Task 3: Layout guard for blocked users + `/suspended` page

**Files:**
- Modify: `src/app/(app)/layout.tsx`
- Create: `src/app/(app)/suspended/page.tsx`

- [ ] **Step 1: Create the suspended page**

`src/app/(app)/suspended/page.tsx`:
```tsx
import { ShieldOff } from 'lucide-react'
import Link from 'next/link'

export default function SuspendedPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 space-y-4">
      <div
        className="h-14 w-14 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(239,68,68,0.15)' }}
      >
        <ShieldOff className="h-7 w-7 text-red-400" />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-foreground">Acesso suspenso</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          Sua conta foi suspensa por falta de pagamento. Entre em contato com o suporte para reativar seu acesso.
        </p>
      </div>
      <Link
        href="/api/auth/logout"
        className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
      >
        Sair da conta
      </Link>
    </div>
  )
}
```

- [ ] **Step 2: Update layout guard in `src/app/(app)/layout.tsx`**

After the `storedUser` null check (line 24), add a blocked redirect before the onboarding guard:

```ts
// JWT válido mas usuário deletado do banco → limpa cookie e redireciona
if (!storedUser) {
  redirect('/api/auth/logout')
}

// Usuário bloqueado → tela de acesso suspenso
if (storedUser.blocked) {
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''
  if (!pathname.startsWith('/suspended')) {
    redirect('/suspended')
  }
}
```

Also update `ROUTES` import if needed, or use the string literal `/suspended` directly.

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/suspended/page.tsx src/app/(app)/layout.tsx
git commit -m "feat: blocked user redirect to /suspended page"
```

---

## Task 4: Update `UsersClient` with status badge + edit/delete/block UI

**Files:**
- Modify: `src/app/(admin)/console/users/page.tsx`
- Modify: `src/app/(admin)/console/users/users-client.tsx`

- [ ] **Step 1: Update `page.tsx` to pass `blocked` and `status` to `UserRow`**

```tsx
import { listUsers } from '@/server/repositories/users'
import type { UserRow } from './users-client'
import { UsersClient } from './users-client'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const allUsers = await listUsers()
  const users: UserRow[] = allUsers
    .filter((u) => u.role === 'user')
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      specialty: u.specialty,
      phone: u.phone,
      createdAt: u.createdAt,
      blocked: u.blocked,
      status: u.blocked
        ? 'blocked'
        : u.passwordIsTemp || !u.onboardingCompleted
          ? 'onboarding'
          : 'active',
    }))

  return <UsersClient initialUsers={users} />
}
```

- [ ] **Step 2: Rewrite `users-client.tsx`**

Full replacement — adds `blocked`, `status`, `phone` to `UserRow`; dynamic badge; `EditModal`; `DeleteConfirmModal`; action buttons per row using `processingId` pattern.

```tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card } from '@/components/ui/card'
import {
  UserPlus, X, Stethoscope, Mail, User, Phone,
  CheckCircle, Users, Pencil, Trash2, ShieldOff, ShieldCheck,
} from 'lucide-react'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty'
import { createUserSchema, type CreateUserFormData } from '@/lib/schemas'
import { PageHeader } from '@/components/console/page-header'
import { toast } from 'sonner'

export interface UserRow {
  id: string
  name: string
  email: string
  specialty?: string
  phone?: string
  createdAt: string
  blocked: boolean
  status: 'onboarding' | 'active' | 'blocked'
}

const editSchema = z.object({
  name: z.string().min(2, 'Nome muito curto'),
  specialty: z.string().optional(),
  phone: z.string().optional(),
})
type EditFormData = z.infer<typeof editSchema>

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

function StatusBadge({ status }: { status: UserRow['status'] }) {
  if (status === 'onboarding') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border bg-amber-500/15 text-amber-400 border-amber-500/20 shrink-0">
        Onboarding
      </span>
    )
  }
  if (status === 'blocked') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border bg-red-500/15 text-red-400 border-red-500/20 shrink-0">
        Bloqueado
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/20 shrink-0">
      Ativo
    </span>
  )
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: (u: UserRow) => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    mode: 'onBlur',
  })

  async function onSubmit(data: CreateUserFormData) {
    const tempPassword = Math.random().toString(36).slice(2, 10)
    const promise = fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, password: tempPassword }),
    }).then(async (res) => {
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Erro ao criar usuário')
      }
      window.open(`https://wa.me/${data.phone.replace(/\D/g, '')}?text=${encodeURIComponent([
        '✅ *Anamnese IA — Acesso criado!*', '',
        `Olá, ${data.name.split(' ')[0]}! Seu acesso à plataforma foi criado.`, '',
        `*Link:* https://anamnese.ai/login`,
        `*Email:* ${data.email}`,
        `*Senha provisória:* ${tempPassword}`, '',
        '_Recomendamos alterar a senha no primeiro acesso._',
      ].join('\n'))}`, '_blank')
      onCreated({
        id: crypto.randomUUID(),
        name: data.name,
        email: data.email,
        specialty: data.specialty,
        phone: data.phone,
        createdAt: new Date().toISOString(),
        blocked: false,
        status: 'onboarding',
      })
    })
    toast.promise(promise, { loading: 'Criando usuário...', success: 'Usuário criado com sucesso!', error: (err: Error) => err.message })
    await promise.catch(() => {})
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <Card className="relative w-full max-w-md p-6 space-y-5 z-10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Novo usuário</h2>
            <p className="text-xs text-muted-foreground mt-0.5">A senha provisória será enviada via WhatsApp</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Nome completo</label>
            <input {...register('name')} placeholder="Dr. João Silva" className="w-full bg-transparent border-b border-border pb-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#22D3EE] transition-colors" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</label>
            <input {...register('email')} type="email" placeholder="joao@clinica.com" className="w-full bg-transparent border-b border-border pb-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#22D3EE] transition-colors" />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><Stethoscope className="h-3.5 w-3.5" /> Especialidade</label>
            <input {...register('specialty')} placeholder="Clínica Geral, Cardiologia..." className="w-full bg-transparent border-b border-border pb-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#22D3EE] transition-colors" />
            {errors.specialty && <p className="text-xs text-destructive">{errors.specialty.message}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> WhatsApp</label>
            <input {...register('phone')} placeholder="(11) 99999-9999" className="w-full bg-transparent border-b border-border pb-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#22D3EE] transition-colors" />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-xs font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 py-2 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90">
              <CheckCircle className="h-3.5 w-3.5" />
              {isSubmitting ? 'Criando...' : 'Criar e enviar acesso'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}

function EditModal({ user, onClose, onSaved }: { user: UserRow; onClose: () => void; onSaved: (u: UserRow) => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    mode: 'onBlur',
    defaultValues: { name: user.name, specialty: user.specialty ?? '', phone: user.phone ?? '' },
  })

  async function onSubmit(data: EditFormData) {
    const promise = fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(async (res) => {
      if (!res.ok) throw new Error('Erro ao salvar')
      onSaved({ ...user, ...data })
    })
    toast.promise(promise, { loading: 'Salvando...', success: 'Usuário atualizado!', error: (e: Error) => e.message })
    await promise.catch(() => {})
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <Card className="relative w-full max-w-md p-6 space-y-5 z-10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Editar usuário</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Nome completo</label>
            <input {...register('name')} className="w-full bg-transparent border-b border-border pb-1.5 text-sm text-foreground focus:outline-none focus:border-[#22D3EE] transition-colors" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><Stethoscope className="h-3.5 w-3.5" /> Especialidade</label>
            <input {...register('specialty')} className="w-full bg-transparent border-b border-border pb-1.5 text-sm text-foreground focus:outline-none focus:border-[#22D3EE] transition-colors" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> WhatsApp</label>
            <input {...register('phone')} className="w-full bg-transparent border-b border-border pb-1.5 text-sm text-foreground focus:outline-none focus:border-[#22D3EE] transition-colors" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-xs font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 py-2 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              <CheckCircle className="h-3.5 w-3.5" />
              {isSubmitting ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}

function DeleteModal({ user, onClose, onDeleted }: { user: UserRow; onClose: () => void; onDeleted: () => void }) {
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    const promise = fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' }).then(async (res) => {
      if (!res.ok) throw new Error('Erro ao excluir')
      onDeleted()
    })
    toast.promise(promise, { loading: 'Excluindo...', success: 'Usuário excluído!', error: (e: Error) => e.message })
    await promise.catch(() => {}).finally(() => setLoading(false))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <Card className="relative w-full max-w-sm p-6 space-y-4 z-10" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Excluir usuário</h2>
          <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir <strong>{user.name}</strong>? Esta ação não pode ser desfeita.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 text-xs font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
          <button onClick={handleDelete} disabled={loading} className="flex-1 py-2 text-xs font-medium rounded-lg disabled:opacity-50 bg-red-600 text-white hover:bg-red-700 transition-colors">
            {loading ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </Card>
    </div>
  )
}

export function UsersClient({ initialUsers }: { initialUsers: UserRow[] }) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers)
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)

  function handleCreated(user: UserRow) {
    setUsers((prev) => [user, ...prev])
    setShowCreate(false)
  }

  function handleSaved(updated: UserRow) {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
    setEditUser(null)
  }

  function handleDeleted(id: string) {
    setUsers((prev) => prev.filter((u) => u.id !== id))
    setDeleteUser(null)
  }

  async function handleToggleBlock(user: UserRow) {
    const newBlocked = !user.blocked
    setProcessingId(user.id)
    const promise = fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocked: newBlocked }),
    }).then(async (res) => {
      if (!res.ok) throw new Error('Erro ao alterar status')
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, blocked: newBlocked, status: newBlocked ? 'blocked' : 'active' }
            : u
        )
      )
    })
    toast.promise(promise, {
      loading: newBlocked ? 'Bloqueando...' : 'Desbloqueando...',
      success: newBlocked ? 'Usuário bloqueado' : 'Usuário desbloqueado',
      error: (e: Error) => e.message,
    })
    await promise.catch(() => {}).finally(() => setProcessingId(null))
  }

  const action = (
    <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-colors bg-primary text-primary-foreground hover:bg-primary/90">
      <UserPlus className="h-3.5 w-3.5" />
      Novo usuário
    </button>
  )

  return (
    <>
      <div className="space-y-6">
        <PageHeader title="Usuários" description="Profissionais com acesso à plataforma" action={action} />

        {users.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><Users /></EmptyMedia>
              <EmptyTitle className="text-sm font-medium">Nenhum usuário cadastrado</EmptyTitle>
              <EmptyDescription className="text-xs">Crie o primeiro usuário para liberar acesso à plataforma.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                <UserPlus className="h-3.5 w-3.5" />
                Novo usuário
              </button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-4 px-4 py-3 rounded-xl border border-border bg-card">
                <div className="h-9 w-9 rounded-lg shrink-0 flex items-center justify-center text-xs font-semibold text-violet-900" style={{ background: 'linear-gradient(135deg, #A78BFA, #22D3EE)' }}>
                  {getInitials(u.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{u.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                {u.specialty && (
                  <span className="hidden sm:block text-xs text-muted-foreground shrink-0">{u.specialty}</span>
                )}
                <span className="text-xs text-muted-foreground shrink-0 hidden md:block">{formatDate(u.createdAt)}</span>
                <StatusBadge status={u.status} />
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleToggleBlock(u)}
                    disabled={processingId === u.id}
                    title={u.blocked ? 'Desbloquear' : 'Bloquear'}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
                  >
                    {u.blocked ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => setEditUser(u)}
                    title="Editar"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteUser(u)}
                    title="Excluir"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />}
      {editUser && <EditModal user={editUser} onClose={() => setEditUser(null)} onSaved={handleSaved} />}
      {deleteUser && <DeleteModal user={deleteUser} onClose={() => setDeleteUser(null)} onDeleted={() => handleDeleted(deleteUser.id)} />}
    </>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(admin)/console/users/
git commit -m "feat: edit/delete/block UI in users console"
```

---

## Task 5: Final test run

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: all tests pass (87+ passing).

- [ ] **Step 2: Manual smoke test**

1. Abrir `/console/users`
2. Criar usuário novo → badge "Onboarding"
3. Editar nome → confirmar atualização na lista
4. Bloquear usuário → badge muda para "Bloqueado"
5. Login com usuário bloqueado → redireciona para `/suspended`
6. Desbloquear → badge volta para "Ativo"
7. Excluir usuário → some da lista
