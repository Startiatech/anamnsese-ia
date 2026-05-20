# Admin Settings Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar a página `/console/settings` com perfil do master e créditos padrão configurável via `system_config` no Supabase.

**Architecture:** Server Component carrega dados (master user + default_credits), passa para Client Component com dois formulários RHF independentes. Server Actions em `src/server/actions/settings.ts` lidam com as mutations. `SystemConfigRepository` em `src/server/repositories/system-config.ts` abstrai a tabela chave-valor.

**Tech Stack:** Next.js App Router Server Actions · React Hook Form + Zod · Web Crypto (hashPassword/comparePassword já existentes) · Supabase service_role · Vitest + `vi.hoisted`

---

## File Map

| Ação | Arquivo |
|---|---|
| Criar | `supabase/migrations/20260410_system_config.sql` |
| Criar | `src/server/repositories/system-config.ts` |
| Criar | `src/server/repositories/system-config.test.ts` |
| Criar | `src/server/actions/settings.ts` |
| Criar | `src/server/actions/settings.test.ts` |
| Modificar | `src/lib/routes.ts` |
| Modificar | `src/app/(admin)/console/admin-layout-client.tsx` |
| Criar | `src/app/(admin)/console/settings/page.tsx` |
| Criar | `src/app/(admin)/console/settings/settings-client.tsx` |
| Modificar | `src/server/repositories/users.ts` (`addUser`) |

---

## Task 1: Migration SQL + SystemConfigRepository

**Files:**
- Create: `supabase/migrations/20260410_system_config.sql`
- Create: `src/server/repositories/system-config.ts`
- Create: `src/server/repositories/system-config.test.ts`

- [ ] **Step 1: Criar migration SQL**

```sql
-- supabase/migrations/20260410_system_config.sql
create table if not exists system_config (
  key   text primary key,
  value text not null
);

insert into system_config (key, value)
values ('default_credits', '5')
on conflict (key) do nothing;
```

- [ ] **Step 2: Aplicar migration no Supabase local/dev**

Rodar no dashboard do Supabase ou via MCP:
```sql
create table if not exists system_config (
  key   text primary key,
  value text not null
);
insert into system_config (key, value) values ('default_credits', '5') on conflict (key) do nothing;
```

- [ ] **Step 3: Escrever os testes (RED)**

```ts
// src/server/repositories/system-config.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }))

vi.mock('@/server/supabase', () => ({
  supabase: { from: mockFrom },
}))

import { SystemConfigRepository } from './system-config'

describe('SystemConfigRepository', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('get', () => {
    it('retorna valor quando chave existe', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { key: 'default_credits', value: '5' } }),
          }),
        }),
      })
      const result = await SystemConfigRepository.get('default_credits')
      expect(result).toBe('5')
    })

    it('retorna null quando chave não existe', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
      })
      const result = await SystemConfigRepository.get('chave_inexistente')
      expect(result).toBeNull()
    })
  })

  describe('set', () => {
    it('faz upsert do valor', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ error: null })
      mockFrom.mockReturnValue({ upsert: mockUpsert })

      await SystemConfigRepository.set('default_credits', '10')

      expect(mockUpsert).toHaveBeenCalledWith(
        { key: 'default_credits', value: '10' },
        { onConflict: 'key' }
      )
    })
  })
})
```

- [ ] **Step 4: Rodar testes e confirmar RED**

```bash
npm test -- system-config.test
```
Esperado: FAIL — `SystemConfigRepository` não existe.

- [ ] **Step 5: Implementar SystemConfigRepository**

```ts
// src/server/repositories/system-config.ts
import { supabase } from '@/server/supabase'

export const SystemConfigRepository = {
  async get(key: string): Promise<string | null> {
    const { data } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', key)
      .maybeSingle()
    return data ? (data as { value: string }).value : null
  },

  async set(key: string, value: string): Promise<void> {
    await supabase
      .from('system_config')
      .upsert({ key, value }, { onConflict: 'key' })
  },
}
```

- [ ] **Step 6: Rodar testes e confirmar GREEN**

```bash
npm test -- system-config.test
```
Esperado: 3 testes PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260410_system_config.sql src/server/repositories/system-config.ts src/server/repositories/system-config.test.ts
git commit -m "feat(settings): add SystemConfigRepository with system_config migration"
```

---

## Task 2: Server Actions — updateMasterProfile e updateDefaultCredits

**Files:**
- Create: `src/server/actions/settings.ts`
- Create: `src/server/actions/settings.test.ts`

- [ ] **Step 1: Escrever testes das actions (RED)**

```ts
// src/server/actions/settings.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom, mockFindById, mockUpdateUser, mockCompare, mockHash, mockConfigSet } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockFindById: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockCompare: vi.fn(),
  mockHash: vi.fn(),
  mockConfigSet: vi.fn(),
}))

vi.mock('@/server/supabase', () => ({ supabase: { from: mockFrom } }))
vi.mock('@/server/repositories/users', () => ({
  findUserById: mockFindById,
  updateUser: mockUpdateUser,
}))
vi.mock('@/server/services/auth', () => ({
  comparePassword: mockCompare,
  hashPassword: mockHash,
}))
vi.mock('@/server/repositories/system-config', () => ({
  SystemConfigRepository: { set: mockConfigSet },
}))

import { updateMasterProfile, updateDefaultCredits } from './settings'

describe('updateMasterProfile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('atualiza nome sem alterar senha quando campos de senha estão vazios', async () => {
    mockFindById.mockResolvedValue({ id: 'u1', name: 'Old', passwordHash: 'hash' })
    mockUpdateUser.mockResolvedValue(undefined)

    const result = await updateMasterProfile('u1', { name: 'New Name' })

    expect(mockUpdateUser).toHaveBeenCalledWith('u1', { name: 'New Name' })
    expect(mockHash).not.toHaveBeenCalled()
    expect(result).toEqual({ ok: true })
  })

  it('atualiza senha quando currentPassword está correto', async () => {
    mockFindById.mockResolvedValue({ id: 'u1', name: 'Master', passwordHash: 'oldhash' })
    mockCompare.mockResolvedValue(true)
    mockHash.mockResolvedValue('newhash')
    mockUpdateUser.mockResolvedValue(undefined)

    const result = await updateMasterProfile('u1', {
      name: 'Master',
      currentPassword: 'correct',
      newPassword: 'newpass123',
      confirmPassword: 'newpass123',
    })

    expect(mockCompare).toHaveBeenCalledWith('correct', 'oldhash')
    expect(mockHash).toHaveBeenCalledWith('newpass123')
    expect(mockUpdateUser).toHaveBeenCalledWith('u1', { name: 'Master', passwordHash: 'newhash' })
    expect(result).toEqual({ ok: true })
  })

  it('rejeita quando currentPassword está errado', async () => {
    mockFindById.mockResolvedValue({ id: 'u1', name: 'Master', passwordHash: 'oldhash' })
    mockCompare.mockResolvedValue(false)

    const result = await updateMasterProfile('u1', {
      name: 'Master',
      currentPassword: 'wrong',
      newPassword: 'newpass123',
      confirmPassword: 'newpass123',
    })

    expect(mockUpdateUser).not.toHaveBeenCalled()
    expect(result).toEqual({ ok: false, error: 'Senha atual incorreta.' })
  })

  it('rejeita quando confirmPassword não confere com newPassword', async () => {
    mockFindById.mockResolvedValue({ id: 'u1', name: 'Master', passwordHash: 'oldhash' })

    const result = await updateMasterProfile('u1', {
      name: 'Master',
      currentPassword: 'correct',
      newPassword: 'newpass123',
      confirmPassword: 'diferente',
    })

    expect(mockCompare).not.toHaveBeenCalled()
    expect(result).toEqual({ ok: false, error: 'A confirmação de senha não confere.' })
  })
})

describe('updateDefaultCredits', () => {
  beforeEach(() => vi.clearAllMocks())

  it('salva valor válido', async () => {
    mockConfigSet.mockResolvedValue(undefined)

    const result = await updateDefaultCredits(10)

    expect(mockConfigSet).toHaveBeenCalledWith('default_credits', '10')
    expect(result).toEqual({ ok: true })
  })

  it('rejeita valor menor que 1', async () => {
    const result = await updateDefaultCredits(0)
    expect(mockConfigSet).not.toHaveBeenCalled()
    expect(result).toEqual({ ok: false, error: 'Valor deve ser entre 1 e 200.' })
  })

  it('rejeita valor maior que 200', async () => {
    const result = await updateDefaultCredits(201)
    expect(mockConfigSet).not.toHaveBeenCalled()
    expect(result).toEqual({ ok: false, error: 'Valor deve ser entre 1 e 200.' })
  })
})
```

- [ ] **Step 2: Rodar testes e confirmar RED**

```bash
npm test -- settings.test
```
Esperado: FAIL — `updateMasterProfile` e `updateDefaultCredits` não existem.

- [ ] **Step 3: Implementar as Server Actions**

```ts
// src/server/actions/settings.ts
'use server'

import { findUserById, updateUser } from '@/server/repositories/users'
import { comparePassword, hashPassword } from '@/server/services/auth'
import { SystemConfigRepository } from '@/server/repositories/system-config'

interface ProfileInput {
  name: string
  currentPassword?: string
  newPassword?: string
  confirmPassword?: string
}

export async function updateMasterProfile(
  userId: string,
  data: ProfileInput
): Promise<{ ok: boolean; error?: string }> {
  const { name, currentPassword, newPassword, confirmPassword } = data

  if (newPassword) {
    if (confirmPassword !== newPassword) {
      return { ok: false, error: 'A confirmação de senha não confere.' }
    }
    const user = await findUserById(userId)
    if (!user) return { ok: false, error: 'Usuário não encontrado.' }

    const valid = await comparePassword(currentPassword ?? '', user.passwordHash)
    if (!valid) return { ok: false, error: 'Senha atual incorreta.' }

    const newHash = await hashPassword(newPassword)
    await updateUser(userId, { name, passwordHash: newHash })
    return { ok: true }
  }

  await updateUser(userId, { name })
  return { ok: true }
}

export async function updateDefaultCredits(
  value: number
): Promise<{ ok: boolean; error?: string }> {
  if (value < 1 || value > 200) {
    return { ok: false, error: 'Valor deve ser entre 1 e 200.' }
  }
  await SystemConfigRepository.set('default_credits', String(value))
  return { ok: true }
}
```

- [ ] **Step 4: Rodar testes e confirmar GREEN**

```bash
npm test -- settings.test
```
Esperado: 7 testes PASS.

- [ ] **Step 5: Verificar que `updateUser` aceita `passwordHash`**

Abrir `src/server/repositories/users.ts` e confirmar que `updateUser` aceita `passwordHash` em seu `Partial<Pick<...>>`. Se não aceitar, adicionar ao tipo:

```ts
// Linha ~77 de users.ts — verificar a assinatura atual:
export async function updateUser(
  id: string,
  data: Partial<Pick<StoredUser, 'name' | 'specialty' | 'phone' | 'blocked' | 'passwordHash'>>
): Promise<void> {
  const update: Record<string, unknown> = {}
  if (data.name !== undefined)         update.name          = data.name
  if (data.specialty !== undefined)    update.specialty     = data.specialty
  if (data.phone !== undefined)        update.phone         = data.phone
  if (data.blocked !== undefined)      update.blocked       = data.blocked
  if (data.passwordHash !== undefined) update.password_hash = data.passwordHash
  await supabase.from('users').update(update).eq('id', id)
}
```

- [ ] **Step 6: Commit**

```bash
git add src/server/actions/settings.ts src/server/actions/settings.test.ts src/server/repositories/users.ts
git commit -m "feat(settings): add updateMasterProfile and updateDefaultCredits server actions"
```

---

## Task 3: Fix de Rota e Nav

**Files:**
- Modify: `src/lib/routes.ts`
- Modify: `src/app/(admin)/console/admin-layout-client.tsx`

- [ ] **Step 1: Adicionar `consoleSettings` ao ROUTES**

Em `src/lib/routes.ts`, localizar o bloco `ROUTES` e adicionar após `consoleFeedbacks`:

```ts
consoleSettings: '/console/settings',
```

- [ ] **Step 2: Corrigir href do nav no admin-layout-client**

Em `src/app/(admin)/console/admin-layout-client.tsx`, linha ~30, alterar:

```ts
// ANTES:
{ href: '/console/settings', label: 'Configurações', icon: Settings },

// DEPOIS:
{ href: ROUTES.consoleSettings, label: 'Configurações', icon: Settings },
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/routes.ts src/app/(admin)/console/admin-layout-client.tsx
git commit -m "fix(routes): add consoleSettings to ROUTES and fix hardcoded nav href"
```

---

## Task 4: Page Server Component

**Files:**
- Create: `src/app/(admin)/console/settings/page.tsx`

- [ ] **Step 1: Criar page.tsx**

```tsx
// src/app/(admin)/console/settings/page.tsx
import { redirect } from 'next/navigation'
import { getServerUser } from '@/server/services/session'
import { findUserById } from '@/server/repositories/users'
import { SystemConfigRepository } from '@/server/repositories/system-config'
import { ROUTES } from '@/lib/routes'
import { SettingsClient } from './settings-client'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const sessionUser = await getServerUser()
  if (!sessionUser || sessionUser.role !== 'master') {
    redirect(ROUTES.login)
  }

  const [user, defaultCreditsRaw] = await Promise.all([
    findUserById(sessionUser.id),
    SystemConfigRepository.get('default_credits'),
  ])

  if (!user) redirect(ROUTES.login)

  const defaultCredits = parseInt(defaultCreditsRaw ?? '5', 10)

  return (
    <SettingsClient
      userId={user.id}
      userName={user.name}
      defaultCredits={defaultCredits}
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(admin)/console/settings/page.tsx
git commit -m "feat(settings): add settings page server component"
```

---

## Task 5: SettingsClient — UI

**Files:**
- Create: `src/app/(admin)/console/settings/settings-client.tsx`

- [ ] **Step 1: Criar settings-client.tsx**

```tsx
// src/app/(admin)/console/settings/settings-client.tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/console/page-header'
import { updateMasterProfile, updateDefaultCredits } from '@/server/actions/settings'

// ── Schemas ──────────────────────────────────────────────────────────────────

const profileSchema = z
  .object({
    name: z.string().min(2, 'Nome muito curto'),
    currentPassword: z.string().optional(),
    newPassword: z.string().optional(),
    confirmPassword: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.newPassword) {
      if (!data.currentPassword) {
        ctx.addIssue({ code: 'custom', path: ['currentPassword'], message: 'Informe a senha atual' })
      }
      if (data.newPassword.length < 6) {
        ctx.addIssue({ code: 'custom', path: ['newPassword'], message: 'Mínimo 6 caracteres' })
      }
      if (data.confirmPassword !== data.newPassword) {
        ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Senhas não conferem' })
      }
    }
  })

const creditsSchema = z.object({
  defaultCredits: z.coerce.number().int().min(1, 'Mínimo 1').max(200, 'Máximo 200'),
})

type ProfileForm = z.infer<typeof profileSchema>
type CreditsForm = z.infer<typeof creditsSchema>

// ── Props ─────────────────────────────────────────────────────────────────────

interface SettingsClientProps {
  userId: string
  userName: string
  defaultCredits: number
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SettingsClient({ userId, userName, defaultCredits }: SettingsClientProps) {
  const profile = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    mode: 'onTouched',
    defaultValues: { name: userName, currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const credits = useForm<CreditsForm>({
    resolver: zodResolver(creditsSchema),
    mode: 'onTouched',
    defaultValues: { defaultCredits },
  })

  async function onProfileSubmit(data: ProfileForm) {
    const promise = updateMasterProfile(userId, {
      name: data.name,
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
      confirmPassword: data.confirmPassword,
    }).then(r => {
      if (!r.ok) throw new Error(r.error)
      return r
    })
    toast.promise(promise, {
      loading: 'Aguarde...',
      success: 'Perfil atualizado.',
      error: (e: Error) => e.message,
    })
    await promise.catch(() => {})
  }

  async function onCreditsSubmit(data: CreditsForm) {
    const promise = updateDefaultCredits(data.defaultCredits).then(r => {
      if (!r.ok) throw new Error(r.error)
      return r
    })
    toast.promise(promise, {
      loading: 'Aguarde...',
      success: 'Créditos padrão atualizados.',
      error: (e: Error) => e.message,
    })
    await promise.catch(() => {})
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Gerencie seu perfil e parâmetros do sistema." />

      {/* Perfil */}
      <Card>
        <CardHeader>
          <p className="text-sm font-semibold text-foreground">Perfil</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={profile.handleSubmit(onProfileSubmit)} className="space-y-4 max-w-sm">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nome</label>
              <input
                {...profile.register('name')}
                className="w-full bg-transparent border-b border-border pb-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#22D3EE] transition-colors"
              />
              {profile.formState.errors.name && (
                <p className="text-xs text-destructive">{profile.formState.errors.name.message}</p>
              )}
            </div>

            <p className="text-xs text-muted-foreground pt-2">Trocar senha (opcional)</p>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Senha atual</label>
              <input
                {...profile.register('currentPassword')}
                type="password"
                className="w-full bg-transparent border-b border-border pb-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#22D3EE] transition-colors"
              />
              {profile.formState.errors.currentPassword && (
                <p className="text-xs text-destructive">{profile.formState.errors.currentPassword.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nova senha</label>
              <input
                {...profile.register('newPassword')}
                type="password"
                className="w-full bg-transparent border-b border-border pb-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#22D3EE] transition-colors"
              />
              {profile.formState.errors.newPassword && (
                <p className="text-xs text-destructive">{profile.formState.errors.newPassword.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Confirmar nova senha</label>
              <input
                {...profile.register('confirmPassword')}
                type="password"
                className="w-full bg-transparent border-b border-border pb-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#22D3EE] transition-colors"
              />
              {profile.formState.errors.confirmPassword && (
                <p className="text-xs text-destructive">{profile.formState.errors.confirmPassword.message}</p>
              )}
            </div>

            <Button type="submit" disabled={profile.formState.isSubmitting}>
              {profile.formState.isSubmitting ? 'Aguarde...' : 'Salvar perfil'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Parâmetros do sistema */}
      <Card>
        <CardHeader>
          <p className="text-sm font-semibold text-foreground">Parâmetros do sistema</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={credits.handleSubmit(onCreditsSubmit)} className="space-y-4 max-w-sm">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Créditos padrão para novos usuários
              </label>
              <input
                {...credits.register('defaultCredits')}
                type="number"
                min={1}
                max={200}
                className="w-full bg-transparent border-b border-border pb-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#22D3EE] transition-colors"
              />
              {credits.formState.errors.defaultCredits && (
                <p className="text-xs text-destructive">{credits.formState.errors.defaultCredits.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Aplicado na criação de novos usuários. Não afeta usuários existentes.
              </p>
            </div>

            <Button type="submit" disabled={credits.formState.isSubmitting}>
              {credits.formState.isSubmitting ? 'Aguarde...' : 'Salvar parâmetros'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(admin)/console/settings/settings-client.tsx
git commit -m "feat(settings): add SettingsClient UI with profile and system params forms"
```

---

## Task 6: Remover hardcode de créditos em addUser

**Files:**
- Modify: `src/server/repositories/users.ts`

- [ ] **Step 1: Atualizar `addUser` para ler de system_config**

Em `src/server/repositories/users.ts`, atualizar `addUser`:

```ts
import { SystemConfigRepository } from '@/server/repositories/system-config'

export async function addUser(user: StoredUser): Promise<void> {
  const defaultCreditsRaw = await SystemConfigRepository.get('default_credits')
  const defaultCredits = parseInt(defaultCreditsRaw ?? '5', 10)

  await supabase.from('users').insert({
    id: user.id,
    name: user.name,
    email: user.email.toLowerCase(),
    password_hash: user.passwordHash,
    role: user.role,
    specialty: user.specialty,
    phone: user.phone,
    password_is_temp: user.passwordIsTemp ?? true,
    plan_id: 'experimental',
    plan_selected: user.planSelected ?? false,
    credits_remaining: user.creditsRemaining ?? defaultCredits,
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/repositories/users.ts
git commit -m "feat(settings): addUser reads default_credits from system_config instead of hardcode"
```

---

## Task 7: Verificação final

- [ ] **Step 1: Rodar todos os testes**

```bash
npm test
```
Esperado: todos PASS, sem regressões.

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```
Esperado: sem erros de tipo.
