# Remove default_credits + Add Inject Credits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover o mecanismo de `default_credits` do sistema (créditos de novos usuários vêm do plano experimental) e adicionar ação de injeção de créditos por usuário na página `/console/users`.

**Architecture:** A remoção é cirúrgica — apaga `updateDefaultCredits` da action, o campo da UI de settings, e o fallback em `addUser`. A injeção de créditos é uma nova Server Action `injectCredits(userId, amount)` exposta via botão na tabela de usuários do console, seguindo o padrão existente de `toast.promise`.

**Tech Stack:** Next.js 16 App Router · Server Actions (`'use server'`) · React Hook Form + Zod · Vitest + `vi.hoisted` · `CreditRepository.setCredits` (existente) · shadcn/ui (Button, Dialog)

---

## Mapa de arquivos

| Arquivo | Ação | O que muda |
|---|---|---|
| `src/server/actions/settings.ts` | Modificar | Remove `updateDefaultCredits` e import de `SystemConfigRepository` |
| `src/server/actions/settings.test.ts` | Modificar | Remove describe `updateDefaultCredits` e `mockConfigSet` |
| `src/server/repositories/users.ts` | Modificar | Remove `SystemConfigRepository.get('default_credits')` de `addUser`; usa `user.creditsRemaining ?? 0` |
| `src/app/(admin)/console/settings/page.tsx` | Modificar | Remove `SystemConfigRepository` import + leitura + prop `defaultCredits` |
| `src/app/(admin)/console/settings/settings-client.tsx` | Modificar | Remove form de créditos, `creditsSchema`, `onCreditsSubmit`, import `updateDefaultCredits` |
| `src/app/(admin)/console/settings/page.test.ts` | Modificar | Remove expectativas de `mockConfigGet`; adiciona mock de `SystemConfigRepository` removido |
| `src/server/actions/credits.ts` | Criar | `injectCredits(userId, amount)` Server Action |
| `src/server/actions/credits.test.ts` | Criar | Testes TDD para `injectCredits` |
| `src/app/(admin)/console/users/page.tsx` | Modificar | Adiciona campo `credits` ao `UserRow` mapeado de `u.creditsRemaining` |
| `src/app/(admin)/console/users/users-client.tsx` | Modificar | Adiciona `credits` a `UserRow`, modal `InjectCreditsModal`, botão de ação |

---

### Task 1: Remover `updateDefaultCredits` da action e seus testes

**Files:**
- Modify: `src/server/actions/settings.ts`
- Modify: `src/server/actions/settings.test.ts`

- [ ] **Step 1: Atualizar `settings.ts` — remover `updateDefaultCredits` e import**

Substituir o conteúdo de `src/server/actions/settings.ts` por:

```ts
'use server'

import { findUserById, updateUser } from '@/server/repositories/users'
import { comparePassword, hashPassword } from '@/server/services/auth'

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
```

- [ ] **Step 2: Atualizar `settings.test.ts` — remover bloco `updateDefaultCredits` e `mockConfigSet`**

Substituir o conteúdo por:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFindById, mockUpdateUser, mockCompare, mockHash } = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockCompare: vi.fn(),
  mockHash: vi.fn(),
}))

vi.mock('@/server/repositories/users', () => ({
  findUserById: mockFindById,
  updateUser: mockUpdateUser,
}))
vi.mock('@/server/services/auth', () => ({
  comparePassword: mockCompare,
  hashPassword: mockHash,
}))

import { updateMasterProfile } from './settings'

describe('updateMasterProfile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('atualiza nome sem alterar senha quando campos de senha estão vazios', async () => {
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
```

- [ ] **Step 3: Rodar testes para confirmar GREEN**

```bash
npm test -- --run src/server/actions/settings.test.ts
```
Expected: todos os testes passando.

---

### Task 2: Remover `default_credits` de `addUser` no repositório

**Files:**
- Modify: `src/server/repositories/users.ts`

- [ ] **Step 1: Remover import e lógica de `default_credits` em `addUser`**

Localizar e remover a linha de import:
```ts
import { SystemConfigRepository } from '@/server/repositories/system-config'
```

Localizar em `addUser` e substituir:
```ts
// ANTES:
const defaultCreditsRaw = await SystemConfigRepository.get('default_credits')
const defaultCredits = parseInt(defaultCreditsRaw ?? '5', 10)
// ...
credits_remaining: user.creditsRemaining ?? defaultCredits,

// DEPOIS:
credits_remaining: user.creditsRemaining ?? 0,
```

- [ ] **Step 2: Rodar testes existentes**

```bash
npm test -- --run src/server/repositories/
```
Expected: todos passando (nenhum teste de `addUser` dependia de `default_credits`).

---

### Task 3: Remover form de créditos da settings UI

**Files:**
- Modify: `src/app/(admin)/console/settings/page.tsx`
- Modify: `src/app/(admin)/console/settings/settings-client.tsx`
- Modify: `src/app/(admin)/console/settings/page.test.ts`

- [ ] **Step 1: Atualizar `page.tsx` — remover SystemConfigRepository e prop defaultCredits**

```ts
import { redirect } from 'next/navigation'
import { getServerUser } from '@/server/services/session'
import { ROUTES } from '@/lib/routes'
import { SettingsClient } from './settings-client'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const sessionUser = await getServerUser()
  if (!sessionUser) redirect(ROUTES.login)
  if (sessionUser.role !== 'master') redirect(ROUTES.console)

  return (
    <SettingsClient
      userId={sessionUser.sub}
      userName={sessionUser.name}
    />
  )
}
```

- [ ] **Step 2: Atualizar `settings-client.tsx` — remover seção de créditos**

Remover:
- Import `updateDefaultCredits` de `@/server/actions/settings`
- `creditsSchema` e `CreditsForm` type
- `const credits = useForm<CreditsForm>(...)`
- Função `onCreditsSubmit`
- O `<Card>` inteiro de "Parâmetros do sistema"
- Prop `defaultCredits` do componente

A assinatura do componente fica:
```tsx
export function SettingsClient({ userId, userName }: { userId: string; userName: string })
```

- [ ] **Step 3: Atualizar `page.test.ts` — remover expectativas de mockConfigGet**

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetServerUser, mockRedirect } = vi.hoisted(() => ({
  mockGetServerUser: vi.fn(),
  mockRedirect: vi.fn(),
}))

vi.mock('@/server/services/session', () => ({ getServerUser: mockGetServerUser }))
vi.mock('next/navigation', () => ({ redirect: mockRedirect }))
vi.mock('./settings-client', () => ({ SettingsClient: () => null }))

import SettingsPage from './page'

describe('console/settings/page', () => {
  beforeEach(() => vi.clearAllMocks())

  it('redireciona para login quando não há sessão', async () => {
    mockGetServerUser.mockResolvedValue(null)
    mockRedirect.mockImplementation(() => { throw new Error('REDIRECT') })

    await expect(SettingsPage()).rejects.toThrow('REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('redireciona para console quando role não é master', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1', name: 'Admin', role: 'admin' })
    mockRedirect.mockImplementation(() => { throw new Error('REDIRECT') })

    await expect(SettingsPage()).rejects.toThrow('REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/console')
  })

  it('renderiza SettingsClient com dados do JWT para master', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1', name: 'Master', role: 'master' })

    await SettingsPage()

    expect(mockRedirect).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 4: Rodar testes**

```bash
npm test -- --run src/app/\\(admin\\)/console/settings/
```
Expected: todos passando.

---

### Task 4: Criar Server Action `injectCredits` com TDD

**Files:**
- Create: `src/server/actions/credits.test.ts`
- Create: `src/server/actions/credits.ts`

- [ ] **Step 1: Escrever testes (RED)**

Criar `src/server/actions/credits.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSetCredits, mockGetCredits } = vi.hoisted(() => ({
  mockSetCredits: vi.fn(),
  mockGetCredits: vi.fn(),
}))

vi.mock('@/server/repositories/credits', () => ({
  CreditRepository: {
    setCredits: mockSetCredits,
    getCredits: mockGetCredits,
  },
}))

import { injectCredits } from './credits'

describe('injectCredits', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejeita amount = 0', async () => {
    const result = await injectCredits('u1', 0)
    expect(result).toEqual({ ok: false, error: 'Quantidade deve ser entre 1 e 500.' })
    expect(mockSetCredits).not.toHaveBeenCalled()
  })

  it('rejeita amount negativo', async () => {
    const result = await injectCredits('u1', -5)
    expect(result).toEqual({ ok: false, error: 'Quantidade deve ser entre 1 e 500.' })
    expect(mockSetCredits).not.toHaveBeenCalled()
  })

  it('rejeita amount > 500', async () => {
    const result = await injectCredits('u1', 501)
    expect(result).toEqual({ ok: false, error: 'Quantidade deve ser entre 1 e 500.' })
    expect(mockSetCredits).not.toHaveBeenCalled()
  })

  it('soma créditos atuais e persiste o total', async () => {
    mockGetCredits.mockResolvedValue(10)
    mockSetCredits.mockResolvedValue(undefined)

    const result = await injectCredits('u1', 20)

    expect(mockGetCredits).toHaveBeenCalledWith('u1')
    expect(mockSetCredits).toHaveBeenCalledWith('u1', 30)
    expect(result).toEqual({ ok: true, newTotal: 30 })
  })

  it('funciona quando usuário tem 0 créditos', async () => {
    mockGetCredits.mockResolvedValue(0)
    mockSetCredits.mockResolvedValue(undefined)

    const result = await injectCredits('u1', 50)

    expect(mockSetCredits).toHaveBeenCalledWith('u1', 50)
    expect(result).toEqual({ ok: true, newTotal: 50 })
  })
})
```

- [ ] **Step 2: Rodar para confirmar RED**

```bash
npm test -- --run src/server/actions/credits.test.ts
```
Expected: FAIL — `injectCredits` não existe ainda.

- [ ] **Step 3: Implementar `credits.ts` (GREEN)**

Criar `src/server/actions/credits.ts`:

```ts
'use server'

import { CreditRepository } from '@/server/repositories/credits'

export async function injectCredits(
  userId: string,
  amount: number
): Promise<{ ok: boolean; error?: string; newTotal?: number }> {
  if (amount < 1 || amount > 500) {
    return { ok: false, error: 'Quantidade deve ser entre 1 e 500.' }
  }

  const current = await CreditRepository.getCredits(userId)
  const newTotal = current + amount
  await CreditRepository.setCredits(userId, newTotal)
  return { ok: true, newTotal }
}
```

- [ ] **Step 4: Rodar para confirmar GREEN**

```bash
npm test -- --run src/server/actions/credits.test.ts
```
Expected: 5 testes passando.

---

### Task 5: Adicionar `credits` ao UserRow e botão de injeção na UI

**Files:**
- Modify: `src/app/(admin)/console/users/page.tsx`
- Modify: `src/app/(admin)/console/users/users-client.tsx`

- [ ] **Step 1: Atualizar `page.tsx` — incluir `credits` no mapeamento**

```ts
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
      credits: u.creditsRemaining ?? 0,
      status: u.blocked
        ? 'blocked'
        : u.passwordIsTemp || !u.onboardingCompleted
          ? 'onboarding'
          : 'active',
    }))

  return <UsersClient initialUsers={users} />
}
```

- [ ] **Step 2: Adicionar `credits` à interface `UserRow` em `users-client.tsx`**

Localizar `export interface UserRow` e adicionar campo `credits`:

```ts
export interface UserRow {
  id: string
  name: string
  email: string
  specialty?: string
  phone?: string
  createdAt: string
  blocked: boolean
  credits: number
  status: 'onboarding' | 'active' | 'blocked'
}
```

- [ ] **Step 3: Adicionar `InjectCreditsModal` em `users-client.tsx`**

Adicionar import no topo do arquivo:
```ts
import { Zap } from 'lucide-react'
import { injectCredits } from '@/server/actions/credits'
```

Adicionar o componente modal antes de `export function UsersClient`:

```tsx
function InjectCreditsModal({ user, onClose, onInjected }: {
  user: UserRow
  onClose: () => void
  onInjected: (userId: string, newTotal: number) => void
}) {
  const [amount, setAmount] = useState(10)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const promise = injectCredits(user.id, amount).then((r) => {
      if (!r.ok) throw new Error(r.error)
      onInjected(user.id, r.newTotal!)
      onClose()
      return r
    })
    toast.promise(promise, {
      loading: 'Aguarde...',
      success: `Créditos injetados! Total: ${amount}`,
      error: (e: Error) => e.message,
    })
    await promise.catch(() => {})
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Injetar créditos</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Usuário: <span className="text-foreground font-medium">{user.name}</span>
          {' · '}Créditos atuais: <span className="text-foreground font-medium">{user.credits}</span>
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Quantidade a adicionar</label>
            <input
              type="number"
              min={1}
              max={500}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full bg-transparent border-b border-border pb-1.5 text-sm text-foreground focus:outline-none focus:border-[#22D3EE] transition-colors"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Aguarde...' : `Adicionar ${amount} crédito${amount !== 1 ? 's' : ''}`}
          </Button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Adicionar estado e botão de injeção em `UsersClient`**

No componente `UsersClient`, adicionar estado:
```ts
const [injectUser, setInjectUser] = useState<UserRow | null>(null)
```

Adicionar handler para atualizar créditos no estado local:
```ts
function handleCreditsInjected(userId: string, newTotal: number) {
  setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, credits: newTotal } : u))
}
```

Na linha de ações de cada usuário (junto com Pencil e Trash2), adicionar botão de injeção:
```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="ghost" size="icon" onClick={() => setInjectUser(u)}>
      <Zap className="h-3.5 w-3.5" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>Injetar créditos</TooltipContent>
</Tooltip>
```

Exibir créditos atuais na linha do usuário (próximo ao status badge):
```tsx
<span className="text-xs text-muted-foreground">{u.credits} créditos</span>
```

No final da lista de modais:
```tsx
{injectUser && (
  <InjectCreditsModal
    user={injectUser}
    onClose={() => setInjectUser(null)}
    onInjected={handleCreditsInjected}
  />
)}
```

- [ ] **Step 5: Rodar todos os testes**

```bash
npm test -- --run
```
Expected: todos passando.

- [ ] **Step 6: Commit**

```bash
git add src/server/actions/settings.ts src/server/actions/settings.test.ts
git add src/server/repositories/users.ts
git add src/app/\(admin\)/console/settings/
git add src/server/actions/credits.ts src/server/actions/credits.test.ts
git add src/app/\(admin\)/console/users/
git commit -m "feat(credits): remove default_credits config, add inject credits on users page"
```

---

## Self-Review

**Spec coverage:**
- ✅ `default_credits` removido de settings action, settings UI, settings page, addUser
- ✅ Testes de `updateDefaultCredits` removidos junto com a função
- ✅ `injectCredits` com TDD (RED → GREEN)
- ✅ Modal de injeção na página de usuários com `toast.promise`
- ✅ Créditos atuais visíveis na linha do usuário
- ✅ Estado local atualizado após injeção (sem reload)

**Placeholders:** nenhum — todo código está completo.

**Type consistency:** `UserRow.credits: number` definido na Task 5 Step 2 e usado em Step 3 (`user.credits`) e Step 4 (`handleCreditsInjected`). `injectCredits` retorna `{ ok, newTotal }` definido na Task 4 e consumido na Task 5.
