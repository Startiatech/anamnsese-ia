# Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir todos os problemas de segurança e qualidade identificados no review de prontidão para produção do SaaS Anamnese IA.

**Architecture:** Cinco tasks independentes atacando: remoção de rota de setup, hardening de JWT, upgrade de hash de senha (SHA-256 → bcrypt com migração progressiva), checagem de `blocked` em API routes, atomicidade de créditos via Supabase RPC e limpeza de rotas hardcoded.

**Tech Stack:** Next.js 16 App Router · TypeScript · bcryptjs (pure JS, sem bindings nativos) · Supabase RPC · Vitest `// @vitest-environment node`

---

## Mapa de arquivos

| Arquivo | Ação | O que muda |
|---|---|---|
| `src/app/api/auth/setup/route.ts` | **Deletar** | Rota DEV ONLY |
| `src/server/services/auth.ts` | Modificar | JWT_SECRET throw, bcryptjs, isLegacyHash |
| `src/server/services/auth.test.ts` | Criar | TDD para hashPassword/comparePassword |
| `src/app/api/auth/login/route.ts` | Modificar | Re-hash progressivo na login |
| `src/server/services/session.ts` | Modificar | Adicionar `requireActiveUser()` |
| `src/server/services/session.test.ts` | Criar | TDD para requireActiveUser |
| `src/app/api/transcribe/route.ts` | Modificar | Usar requireActiveUser |
| `src/app/api/anamnesis/route.ts` | Modificar | Usar requireActiveUser |
| `src/app/api/anamnesis/refine/route.ts` | Modificar | Usar requireActiveUser |
| `src/server/repositories/credits.ts` | Modificar | Adicionar `addCredits` via RPC |
| `src/server/actions/credits.ts` | Modificar | Usar `addCredits` em vez de get+set |
| `src/server/actions/credits.test.ts` | Modificar | Atualizar mock para addCredits |
| `src/app/(admin)/console/console-dashboard-client.tsx` | Modificar | ROUTES.* em vez de hardcoded |
| `src/app/suspended/page.tsx` | Modificar | ROUTES.* / API.* em vez de hardcoded |
| `src/app/(auth)/login/login-client.tsx` | Modificar | Remover fallback de telefone pessoal |
| `src/components/export/export-buttons.tsx` | Modificar | Remover fallbacks genéricos de médico |

---

### Task 1: Quick security wins (sem TDD)

**Files:**
- Delete: `src/app/api/auth/setup/route.ts`
- Modify: `src/server/services/auth.ts` (linhas 3-5 — JWT_SECRET)
- Modify: `src/app/(auth)/login/login-client.tsx` (fallback telefone)
- Modify: `src/components/export/export-buttons.tsx` (fallbacks médico)

- [ ] **Step 1: Deletar rota de setup**

```bash
rm 'd:/REPOS-GITHUB-PARTICULAR/project-anamnese-ia-claude-code/src/app/api/auth/setup/route.ts'
```

Verificar que o arquivo foi removido:
```bash
ls 'd:/REPOS-GITHUB-PARTICULAR/project-anamnese-ia-claude-code/src/app/api/auth/setup/' 2>&1
```
Expected: `No such file` ou diretório vazio.

- [ ] **Step 2: Remover fallback inseguro do JWT_SECRET**

Em `src/server/services/auth.ts`, substituir:
```ts
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'dev-secret-change-in-production'
)
```
por:
```ts
const jwtSecretValue = process.env.JWT_SECRET
if (!jwtSecretValue) throw new Error('JWT_SECRET environment variable is not set')
const JWT_SECRET = new TextEncoder().encode(jwtSecretValue)
```

- [ ] **Step 3: Remover fallback de telefone pessoal**

Em `src/app/(auth)/login/login-client.tsx`, localizar a linha:
```ts
const adminPhone = process.env.NEXT_PUBLIC_ADMIN_WHATSAPP ?? '5532999447711'
```
Substituir por:
```ts
const adminPhone = process.env.NEXT_PUBLIC_ADMIN_WHATSAPP ?? ''
```
Localizar onde `adminPhone` é usado para montar o link do WhatsApp e adicionar verificação:
Se já há condicional (`adminPhone && ...`), está ok. Se não, envolver o bloco do botão WhatsApp com `{adminPhone && (...)}`.

- [ ] **Step 4: Remover fallbacks genéricos de médico nos exports**

Em `src/components/export/export-buttons.tsx`, substituir:
```ts
const doctorName = process.env.NEXT_PUBLIC_DOCTOR_NAME ?? 'Dr. Nome do Médico'
const doctorCRM = process.env.NEXT_PUBLIC_DOCTOR_CRM ?? '00000/UF'
const doctorSpecialty = process.env.NEXT_PUBLIC_DOCTOR_SPECIALTY ?? 'Especialidade'
```
por:
```ts
const doctorName = process.env.NEXT_PUBLIC_DOCTOR_NAME ?? ''
const doctorCRM = process.env.NEXT_PUBLIC_DOCTOR_CRM ?? ''
const doctorSpecialty = process.env.NEXT_PUBLIC_DOCTOR_SPECIALTY ?? ''
```

- [ ] **Step 5: Rodar todos os testes**

```bash
npm test -- --run 2>&1 | tail -5
```
Expected: todos passando.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "security: remove setup route, throw on missing JWT_SECRET, remove hardcoded fallbacks"
```

---

### Task 2: Upgrade de hash de senha para bcryptjs com migração progressiva (TDD)

**Files:**
- Modify: `src/server/services/auth.ts`
- Create: `src/server/services/auth.test.ts`
- Modify: `src/app/api/auth/login/route.ts`

**Contexto:** O hash atual usa SHA-256 + salt manual (`saltHex:hashHex`). Vamos migrar para bcryptjs (pure JS, funciona no Vitest node environment). A migração é progressiva: usuários existentes continuam logando com SHA-256, e na próxima login o hash é reescrito com bcrypt automaticamente.

- [ ] **Step 1: Instalar bcryptjs**

```bash
cd 'd:/REPOS-GITHUB-PARTICULAR/project-anamnese-ia-claude-code' && npm install bcryptjs && npm install -D @types/bcryptjs
```

- [ ] **Step 2: Escrever testes (RED)**

Criar `src/server/services/auth.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { hashPassword, comparePassword, isLegacyHash } from './auth'

describe('hashPassword', () => {
  it('gera hash no formato bcrypt ($2b$)', async () => {
    const hash = await hashPassword('minhasenha')
    expect(hash).toMatch(/^\$2b\$/)
  })

  it('gera hashes diferentes para a mesma senha (salt aleatório)', async () => {
    const h1 = await hashPassword('minhasenha')
    const h2 = await hashPassword('minhasenha')
    expect(h1).not.toBe(h2)
  })
})

describe('comparePassword', () => {
  it('valida senha correta contra hash bcrypt', async () => {
    const hash = await hashPassword('senhaCorreta')
    expect(await comparePassword('senhaCorreta', hash)).toBe(true)
  })

  it('rejeita senha incorreta contra hash bcrypt', async () => {
    const hash = await hashPassword('senhaCorreta')
    expect(await comparePassword('senhaErrada', hash)).toBe(false)
  })

  it('valida senha correta contra hash legado SHA-256', async () => {
    // Simula hash antigo gerado pelo sistema anterior
    const salt = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'
    const encoder = new TextEncoder()
    const data = encoder.encode(salt + 'senhaLegada')
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    const legacyStored = `${salt}:${hashHex}`

    expect(await comparePassword('senhaLegada', legacyStored)).toBe(true)
  })

  it('rejeita senha incorreta contra hash legado SHA-256', async () => {
    const salt = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'
    const encoder = new TextEncoder()
    const data = encoder.encode(salt + 'senhaCorreta')
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    const legacyStored = `${salt}:${hashHex}`

    expect(await comparePassword('senhaErrada', legacyStored)).toBe(false)
  })
})

describe('isLegacyHash', () => {
  it('identifica hash legado SHA-256 (formato saltHex:hashHex)', () => {
    expect(isLegacyHash('abc123:def456')).toBe(true)
  })

  it('identifica hash bcrypt como não-legado', () => {
    expect(isLegacyHash('$2b$10$abcdefghijklmnopqrstuvwxyz')).toBe(false)
  })
})
```

- [ ] **Step 3: Rodar para confirmar RED**

```bash
cd 'd:/REPOS-GITHUB-PARTICULAR/project-anamnese-ia-claude-code' && npm test -- --run src/server/services/auth.test.ts 2>&1 | tail -10
```
Expected: FAIL — `isLegacyHash` não existe.

- [ ] **Step 4: Implementar bcryptjs em auth.ts (GREEN)**

Em `src/server/services/auth.ts`, adicionar o import de bcryptjs no topo:
```ts
import bcrypt from 'bcryptjs'
```

Substituir `hashPassword` e `comparePassword` por:
```ts
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function comparePassword(password: string, stored: string): Promise<boolean> {
  // Novo formato bcrypt
  if (stored.startsWith('$2b$') || stored.startsWith('$2a$')) {
    return bcrypt.compare(password, stored)
  }
  // Formato legado SHA-256: saltHex:hashHex
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const encoder = new TextEncoder()
  const data = encoder.encode(salt + password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return hashHex === hash
}

export function isLegacyHash(stored: string): boolean {
  return !stored.startsWith('$2b$') && !stored.startsWith('$2a$')
}
```

- [ ] **Step 5: Rodar para confirmar GREEN**

```bash
npm test -- --run src/server/services/auth.test.ts 2>&1 | tail -10
```
Expected: 7 testes passando.

- [ ] **Step 6: Adicionar re-hash progressivo no login route**

Em `src/app/api/auth/login/route.ts`, adicionar imports:
```ts
import { comparePassword, signToken, COOKIE_NAME, isLegacyHash, hashPassword } from '@/lib/auth'
import { updateUser } from '@/server/repositories/users'
```

Após `if (!valid)`, adicionar bloco de re-hash:
```ts
// Migração progressiva: re-hash com bcrypt se ainda usa SHA-256
if (isLegacyHash(user.passwordHash)) {
  const newHash = await hashPassword(password)
  await updateUser(user.id, { passwordHash: newHash })
}
```

O bloco completo após a verificação de senha fica:
```ts
const valid = await comparePassword(password, user.passwordHash)

if (!valid) {
  return NextResponse.json({ error: 'Email ou senha incorretos' }, { status: 401 })
}

// Migração progressiva: re-hash com bcrypt se ainda usa SHA-256
if (isLegacyHash(user.passwordHash)) {
  const newHash = await hashPassword(password)
  await updateUser(user.id, { passwordHash: newHash })
}
```

- [ ] **Step 7: Rodar todos os testes**

```bash
npm test -- --run 2>&1 | tail -5
```
Expected: todos passando.

- [ ] **Step 8: Commit**

```bash
git add src/server/services/auth.ts src/server/services/auth.test.ts src/app/api/auth/login/route.ts
git commit -m "security: upgrade password hashing to bcrypt with progressive SHA-256 migration"
```

---

### Task 3: Checagem de blocked em user-facing API routes (TDD)

**Files:**
- Modify: `src/server/services/session.ts`
- Create: `src/server/services/session.test.ts`
- Modify: `src/app/api/transcribe/route.ts`
- Modify: `src/app/api/anamnesis/route.ts`
- Modify: `src/app/api/anamnesis/refine/route.ts`

**Contexto:** Um usuário bloqueado com JWT ainda válido pode chamar APIs de transcrição e anamnese. A solução é um helper `requireActiveUser()` que checa o DB antes de autorizar.

- [ ] **Step 1: Escrever testes para requireActiveUser (RED)**

Criar `src/server/services/session.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetCookies, mockVerifyToken, mockFindUserById } = vi.hoisted(() => ({
  mockGetCookies: vi.fn(),
  mockVerifyToken: vi.fn(),
  mockFindUserById: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: mockGetCookies,
}))
vi.mock('@/server/services/auth', () => ({
  verifyToken: mockVerifyToken,
  COOKIE_NAME: 'anamnese_auth',
}))
vi.mock('@/server/repositories/users', () => ({
  findUserById: mockFindUserById,
}))

import { requireActiveUser } from './session'

const mockPayload = { sub: 'u1', email: 'a@b.com', name: 'A', role: 'user' as const }

beforeEach(() => {
  vi.clearAllMocks()
  mockGetCookies.mockResolvedValue({ get: () => ({ value: 'token123' }) })
  mockVerifyToken.mockResolvedValue(mockPayload)
})

describe('requireActiveUser', () => {
  it('retorna null quando não há token', async () => {
    mockGetCookies.mockResolvedValue({ get: () => undefined })
    expect(await requireActiveUser()).toBeNull()
  })

  it('retorna null quando token inválido', async () => {
    mockVerifyToken.mockResolvedValue(null)
    expect(await requireActiveUser()).toBeNull()
  })

  it('retorna null quando usuário não existe no banco', async () => {
    mockFindUserById.mockResolvedValue(undefined)
    expect(await requireActiveUser()).toBeNull()
  })

  it('retorna null quando usuário está bloqueado', async () => {
    mockFindUserById.mockResolvedValue({ id: 'u1', blocked: true })
    expect(await requireActiveUser()).toBeNull()
  })

  it('retorna o payload JWT quando usuário está ativo', async () => {
    mockFindUserById.mockResolvedValue({ id: 'u1', blocked: false })
    const result = await requireActiveUser()
    expect(result).toEqual(mockPayload)
    expect(mockFindUserById).toHaveBeenCalledWith('u1')
  })
})
```

- [ ] **Step 2: Rodar para confirmar RED**

```bash
cd 'd:/REPOS-GITHUB-PARTICULAR/project-anamnese-ia-claude-code' && npm test -- --run src/server/services/session.test.ts 2>&1 | tail -10
```
Expected: FAIL — `requireActiveUser` não existe.

- [ ] **Step 3: Implementar requireActiveUser em session.ts (GREEN)**

Em `src/server/services/session.ts`, adicionar import de `findUserById`:
```ts
import { findUserById } from '@/server/repositories/users'
```

Adicionar a função após `getServerUser`:
```ts
export async function requireActiveUser(): Promise<JWTPayload | null> {
  const sessionUser = await getServerUser()
  if (!sessionUser) return null
  const storedUser = await findUserById(sessionUser.sub)
  if (!storedUser || storedUser.blocked) return null
  return sessionUser
}
```

- [ ] **Step 4: Rodar para confirmar GREEN**

```bash
npm test -- --run src/server/services/session.test.ts 2>&1 | tail -10
```
Expected: 5 testes passando.

- [ ] **Step 5: Aplicar requireActiveUser em transcribe/route.ts**

Em `src/app/api/transcribe/route.ts`, substituir:
```ts
import { getServerUser } from '@/server/services/session'
```
por:
```ts
import { requireActiveUser } from '@/server/services/session'
```

Substituir:
```ts
const user = await getServerUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```
por:
```ts
const user = await requireActiveUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

- [ ] **Step 6: Aplicar requireActiveUser em anamnesis/route.ts**

Em `src/app/api/anamnesis/route.ts`, mesma substituição:
```ts
import { requireActiveUser } from '@/server/services/session'
// ...
const user = await requireActiveUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

- [ ] **Step 7: Aplicar requireActiveUser em anamnesis/refine/route.ts**

```bash
cat 'd:/REPOS-GITHUB-PARTICULAR/project-anamnese-ia-claude-code/src/app/api/anamnesis/refine/route.ts' | head -15
```
Aplicar mesma substituição de `getServerUser` → `requireActiveUser`.

- [ ] **Step 8: Rodar todos os testes**

```bash
npm test -- --run 2>&1 | tail -5
```
Expected: todos passando.

- [ ] **Step 9: Commit**

```bash
git add src/server/services/session.ts src/server/services/session.test.ts
git add src/app/api/transcribe/route.ts src/app/api/anamnesis/route.ts src/app/api/anamnesis/refine/route.ts
git commit -m "security: add blocked user check to user-facing API routes via requireActiveUser"
```

---

### Task 4: Atomicidade de créditos via Supabase RPC

**Files:**
- Supabase migration (via MCP): nova função `add_user_credits`
- Modify: `src/server/repositories/credits.ts`
- Modify: `src/server/actions/credits.ts`
- Modify: `src/server/actions/credits.test.ts`

**Contexto:** `setCredits` faz read-then-write sem lock — dois requests paralelos podem causar race condition. A solução é um RPC Supabase que faz `UPDATE ... SET credits = credits + amount` atomicamente.

- [ ] **Step 1: Aplicar migration no Supabase**

Usar o Supabase MCP tool `apply_migration` com o seguinte SQL:

```sql
CREATE OR REPLACE FUNCTION add_user_credits(p_user_id UUID, p_amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_total INTEGER;
BEGIN
  UPDATE users
  SET credits_remaining = GREATEST(0, credits_remaining + p_amount)
  WHERE id = p_user_id
  RETURNING credits_remaining INTO v_new_total;

  RETURN COALESCE(v_new_total, 0);
END;
$$;
```

- [ ] **Step 2: Adicionar `addCredits` ao CreditRepository**

Em `src/server/repositories/credits.ts`, adicionar após `debitCredit`:
```ts
async addCredits(userId: string, amount: number): Promise<number> {
  const { data } = await supabase.rpc('add_user_credits', {
    p_user_id: userId,
    p_amount: amount,
  })
  return (data as number) ?? 0
},
```

- [ ] **Step 3: Atualizar injectCredits para usar addCredits**

Em `src/server/actions/credits.ts`, substituir o conteúdo por:
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

  const newTotal = await CreditRepository.addCredits(userId, amount)
  return { ok: true, newTotal }
}
```

- [ ] **Step 4: Atualizar credits.test.ts**

Em `src/server/actions/credits.test.ts`, substituir o mock de CreditRepository:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockAddCredits } = vi.hoisted(() => ({
  mockAddCredits: vi.fn(),
}))

vi.mock('@/server/repositories/credits', () => ({
  CreditRepository: {
    addCredits: mockAddCredits,
  },
}))

import { injectCredits } from './credits'

describe('injectCredits', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejeita amount = 0', async () => {
    const result = await injectCredits('u1', 0)
    expect(result).toEqual({ ok: false, error: 'Quantidade deve ser entre 1 e 500.' })
    expect(mockAddCredits).not.toHaveBeenCalled()
  })

  it('rejeita amount negativo', async () => {
    const result = await injectCredits('u1', -5)
    expect(result).toEqual({ ok: false, error: 'Quantidade deve ser entre 1 e 500.' })
    expect(mockAddCredits).not.toHaveBeenCalled()
  })

  it('rejeita amount > 500', async () => {
    const result = await injectCredits('u1', 501)
    expect(result).toEqual({ ok: false, error: 'Quantidade deve ser entre 1 e 500.' })
    expect(mockAddCredits).not.toHaveBeenCalled()
  })

  it('chama addCredits atômico e retorna newTotal', async () => {
    mockAddCredits.mockResolvedValue(30)

    const result = await injectCredits('u1', 20)

    expect(mockAddCredits).toHaveBeenCalledWith('u1', 20)
    expect(result).toEqual({ ok: true, newTotal: 30 })
  })

  it('funciona com amount = 500 (limite máximo)', async () => {
    mockAddCredits.mockResolvedValue(500)

    const result = await injectCredits('u1', 500)

    expect(mockAddCredits).toHaveBeenCalledWith('u1', 500)
    expect(result).toEqual({ ok: true, newTotal: 500 })
  })
})
```

- [ ] **Step 5: Rodar testes**

```bash
npm test -- --run src/server/actions/credits.test.ts 2>&1 | tail -10
```
Expected: 5 testes passando.

- [ ] **Step 6: Commit**

```bash
git add src/server/repositories/credits.ts src/server/actions/credits.ts src/server/actions/credits.test.ts
git commit -m "fix(credits): atomic addCredits via Supabase RPC, remove read-then-write race condition"
```

---

### Task 5: Corrigir rotas hardcoded

**Files:**
- Modify: `src/app/(admin)/console/console-dashboard-client.tsx`
- Modify: `src/app/suspended/page.tsx`

- [ ] **Step 1: Corrigir console-dashboard-client.tsx**

Adicionar import no topo do arquivo (junto com outros imports):
```ts
import { ROUTES } from '@/lib/routes'
```

Substituir todas as ocorrências:
- `href="/console/requests"` → `href={ROUTES.consoleSolicitacoes}` (3 ocorrências)
- `href="/console/users"` → `href={ROUTES.consoleUsuarios}` (1 ocorrência)

- [ ] **Step 2: Corrigir suspended/page.tsx**

Adicionar import:
```ts
import { ROUTES, API } from '@/lib/routes'
```

Substituir:
- `href="/dashboard"` → `href={ROUTES.dashboard}`
- `href="/api/auth/logout"` → `href={API.logout}`

- [ ] **Step 3: Rodar todos os testes**

```bash
npm test -- --run 2>&1 | tail -5
```
Expected: todos passando.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(admin\)/console/console-dashboard-client.tsx src/app/suspended/page.tsx
git commit -m "fix: replace hardcoded routes with ROUTES.* and API.* constants"
```

---

## Self-Review

**Spec coverage:**
- ✅ Task 1: Setup route deletado, JWT_SECRET throw, env var fallbacks removidos
- ✅ Task 2: bcryptjs, migração progressiva SHA-256→bcrypt, 7 testes
- ✅ Task 3: requireActiveUser helper, 5 testes, aplicado em 3 routes
- ✅ Task 4: Supabase RPC atômico, CreditRepository.addCredits, injectCredits simplificado
- ✅ Task 5: Rotas hardcoded corrigidas

**Issue #5 do review (plans/[id] sem role check):** Após leitura do código real, a rota JÁ tem `user.role !== 'admin' && user.role !== 'master'`. Falso positivo do reviewer — não há nada a corrigir.

**Placeholders:** nenhum.

**Type consistency:** `requireActiveUser(): Promise<JWTPayload | null>` — retorna o mesmo tipo de `getServerUser`. `CreditRepository.addCredits(userId, amount): Promise<number>` — consistente com o uso em `injectCredits`.
