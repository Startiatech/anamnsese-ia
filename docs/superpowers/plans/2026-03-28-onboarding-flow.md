# Onboarding Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Forçar troca de senha e preenchimento de perfil obrigatório na primeira entrada do usuário, com plano Experimental ativado automaticamente na aprovação.

**Architecture:** Guard no `(app)/layout.tsx` redireciona para `/configuracoes` enquanto `password_is_temp = true` OU `onboarding_completed = false`. O proxy passa `x-pathname` como request header para o layout via `NextResponse.next({ request: { headers } })`. Configurações exibe checklist visual durante onboarding. Ao completar ambas as etapas, redireciona para `/dashboard`.

**Tech Stack:** Next.js 16 App Router, Supabase (service_role), Vitest, React Hook Form + Zod

---

## Files

| Arquivo | Ação |
|---|---|
| `src/proxy.ts` | Modificar — passar `x-pathname` via `request.headers` |
| `src/app/(app)/layout.tsx` | Modificar — guard usa `password_is_temp` + `onboarding_completed` |
| `src/server/repositories/users.ts` | Modificar — adicionar `passwordIsTemp` ao `StoredUser` + `toStoredUser` |
| `src/app/api/admin/create-user/route.ts` | Modificar — setar `plan_selected=true`, `plan_id='experimental'`, `password_is_temp=true` |
| `src/app/api/users/me/route.ts` | Modificar — troca de senha seta `password_is_temp=false`; perfil seta `onboarding_completed=true` se campos obrigatórios presentes |
| `src/app/(app)/configuracoes/ConfiguracoesClient.tsx` | Modificar — recebe `isOnboarding` prop, exibe checklist |
| `src/app/(app)/configuracoes/page.tsx` | Modificar — passa `isOnboarding` baseado em `password_is_temp` ou `!onboarding_completed` |
| `src/app/(app)/configuracoes/OnboardingChecklist.tsx` | Criar — checklist visual com estado dos 3 passos |
| `src/lib/users.test.ts` | Modificar — adicionar `passwordIsTemp` ao fixture |

---

### Task 1: Migration + `StoredUser` com `passwordIsTemp`

**Files:**
- Modify: `src/server/repositories/users.ts`
- Modify: `src/lib/users.test.ts`

- [ ] **Step 1: Aplicar migration no Supabase**

```sql
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS password_is_temp boolean NOT NULL DEFAULT false;
```

Usar `mcp__supabase__apply_migration` com name `add_password_is_temp_to_users`.

- [ ] **Step 2: Atualizar `StoredUser` e `toStoredUser`**

Em `src/server/repositories/users.ts`, adicionar ao interface:
```ts
passwordIsTemp: boolean
```

Em `toStoredUser`, adicionar:
```ts
passwordIsTemp: (row.password_is_temp as boolean) ?? false,
```

- [ ] **Step 3: Atualizar fixture do teste**

Em `src/lib/users.test.ts`, adicionar ao `mockRow`:
```ts
password_is_temp: false,
```

Adicionar ao `expectedUser`:
```ts
passwordIsTemp: false,
```

Adicionar ao `newUser` no teste `addUser`:
```ts
passwordIsTemp: false,
```

- [ ] **Step 4: Rodar testes**

```bash
npx vitest run src/lib/users.test.ts
```
Esperado: todos passando.

- [ ] **Step 5: Commit**

```bash
git add src/server/repositories/users.ts src/lib/users.test.ts
git commit -m "feat: add passwordIsTemp to StoredUser + migration"
```

---

### Task 2: `create-user` ativa plano Experimental + senha provisória

**Files:**
- Modify: `src/app/api/admin/create-user/route.ts`

- [ ] **Step 1: Atualizar `create-user` para setar os campos no `addUser`**

Em `src/app/api/admin/create-user/route.ts`, alterar o objeto passado para `addUser`:
```ts
await addUser({
  id: crypto.randomUUID(),
  name,
  email,
  passwordHash,
  role: 'user',
  specialty,
  phone,
  planSelected: true,
  passwordIsTemp: true,
  onboardingCompleted: false,
  createdAt: new Date().toISOString(),
})
```

- [ ] **Step 2: Atualizar `addUser` no repository para persistir `password_is_temp`**

Em `src/server/repositories/users.ts`, no método `addUser`, adicionar ao insert:
```ts
password_is_temp: user.passwordIsTemp ?? true,
```

- [ ] **Step 3: Rodar build para confirmar sem erros de tipo**

```bash
npm run build
```
Esperado: `✓ Compiled successfully`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/create-user/route.ts src/server/repositories/users.ts
git commit -m "feat: create-user sets plan experimental + password_is_temp=true"
```

---

### Task 3: Proxy passa `x-pathname` como request header

**Files:**
- Modify: `src/proxy.ts`

- [ ] **Step 1: Corrigir o proxy para passar pathname via request headers**

Substituir o bloco final em `src/proxy.ts`:
```ts
  // Rotas console — exige role admin ou master
  if (ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    if (payload.role !== 'admin' && payload.role !== 'master') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-pathname', pathname)
  return NextResponse.next({ request: { headers: requestHeaders } })
```

> **Nota:** `NextResponse.next({ request: { headers } })` passa o header como request header para o Server Component. Setar em `res.headers` não funciona — os response headers do middleware **não** chegam ao server component.

- [ ] **Step 2: Rodar build**

```bash
npm run build
```
Esperado: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

```bash
git add src/proxy.ts
git commit -m "fix: proxy passes x-pathname via request headers (not response headers)"
```

---

### Task 4: Guard no layout — bloqueia até onboarding completo

**Files:**
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Atualizar o guard no layout**

Substituir o bloco `// ─── Guard de onboarding` em `src/app/(app)/layout.tsx`:
```ts
// ─── Guard de onboarding ────────────────────────────────────────────────
const { headers } = await import('next/headers')
const headersList = await headers()
const pathname = headersList.get('x-pathname') ?? ''

const isOnboardingRoute = pathname.startsWith(ROUTES.configuracoes)

if (!isOnboardingRoute && storedUser) {
  if (storedUser.passwordIsTemp || !storedUser.onboardingCompleted) {
    redirect(ROUTES.configuracoes)
  }
}
```

Também remover a importação de `ROUTES.planos` do array `ONBOARDING_FREE` e simplificar — não é mais necessário o array, só verificar `/configuracoes`.

- [ ] **Step 2: Rodar build**

```bash
npm run build
```
Esperado: `✓ Compiled successfully`

- [ ] **Step 3: Setar usuário de teste no banco para testar o guard**

```sql
UPDATE public.users
SET password_is_temp = true, onboarding_completed = false, plan_selected = true, plan_id = 'experimental'
WHERE email = 'profissional01teste@gmail.com';
```

Usar `mcp__supabase__execute_sql`.

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/layout.tsx
git commit -m "fix: onboarding guard — bloqueia em /configuracoes até senha + perfil completos"
```

---

### Task 5: API `/api/users/me` marca etapas concluídas

**Files:**
- Modify: `src/app/api/users/me/route.ts`

- [ ] **Step 1: Troca de senha seta `password_is_temp = false`**

No bloco de troca de senha em `src/app/api/users/me/route.ts`, após `await supabase.from('users').update(...)`:
```ts
const newHash = await hashPassword(body.newPassword)
await supabase.from('users').update({
  password_hash: newHash,
  password_is_temp: false,
}).eq('id', payload.sub)
return NextResponse.json({ ok: true })
```

- [ ] **Step 2: Salvar perfil seta `onboarding_completed = true` se campos obrigatórios presentes**

No bloco de atualização de perfil, substituir o update:
```ts
const { name, phone, specialty, crmType, crmNumber, crmUf } = body

const profileComplete = !!(specialty?.trim() && crmNumber?.trim() && crmUf?.trim())

await supabase.from('users').update({
  name,
  phone,
  specialty,
  crm_type:            crmType,
  crm_number:          crmNumber,
  crm_uf:              crmUf,
  ...(profileComplete ? { onboarding_completed: true } : {}),
}).eq('id', payload.sub)

return NextResponse.json({ ok: true, onboardingCompleted: profileComplete })
```

- [ ] **Step 3: Rodar build**

```bash
npm run build
```
Esperado: `✓ Compiled successfully`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/users/me/route.ts
git commit -m "feat: PATCH /users/me sets password_is_temp=false on pwd change; onboarding_completed=true on full profile"
```

---

### Task 6: Checklist visual no `/configuracoes` durante onboarding

**Files:**
- Create: `src/app/(app)/configuracoes/OnboardingChecklist.tsx`
- Modify: `src/app/(app)/configuracoes/page.tsx`
- Modify: `src/app/(app)/configuracoes/ConfiguracoesClient.tsx`

- [ ] **Step 1: Criar `OnboardingChecklist.tsx`**

```tsx
// src/app/(app)/configuracoes/OnboardingChecklist.tsx
import { CheckCircle2, Circle } from 'lucide-react'

interface Props {
  passwordChanged: boolean
  profileCompleted: boolean
}

export function OnboardingChecklist({ passwordChanged, profileCompleted }: Props) {
  const steps = [
    { label: 'Plano ativado',      done: true },
    { label: 'Trocar senha',       done: passwordChanged },
    { label: 'Completar perfil',   done: profileCompleted },
  ]

  const allDone = passwordChanged && profileCompleted

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Configure sua conta para começar
      </p>
      <div className="space-y-2">
        {steps.map(({ label, done }) => (
          <div key={label} className="flex items-center gap-2.5">
            {done
              ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              : <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
            }
            <span className={`text-sm ${done ? 'text-foreground line-through opacity-50' : 'text-foreground'}`}>
              {label}
            </span>
          </div>
        ))}
      </div>
      {allDone && (
        <a
          href="/dashboard"
          className="mt-2 flex items-center justify-center w-full h-9 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
        >
          Acessar plataforma →
        </a>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Atualizar `page.tsx` para passar `isOnboarding` + estados do checklist**

Em `src/app/(app)/configuracoes/page.tsx`:
```ts
export default async function ConfiguracoesPage() {
  const payload = await getServerUser()
  if (!payload) redirect(ROUTES.login)

  const user = await findUserById(payload.sub)
  if (!user) redirect(ROUTES.login)

  const isOnboarding = user.passwordIsTemp || !user.onboardingCompleted

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Gerencie seu perfil e preferências da conta." />
      <ConfiguracoesClient
        user={user}
        isOnboarding={isOnboarding}
        passwordChanged={!user.passwordIsTemp}
        profileCompleted={user.onboardingCompleted}
      />
    </div>
  )
}
```

- [ ] **Step 3: Atualizar `ConfiguracoesClient.tsx` para receber props e exibir checklist**

Adicionar props à interface e renderizar o checklist quando `isOnboarding = true`:
```tsx
export function ConfiguracoesClient({
  user,
  isOnboarding,
  passwordChanged,
  profileCompleted,
}: {
  user: StoredUser
  isOnboarding: boolean
  passwordChanged: boolean
  profileCompleted: boolean
}) {
  const [active, setActive] = useState<TabId>('perfil')

  return (
    <div className="space-y-6">
      {isOnboarding && (
        <OnboardingChecklist
          passwordChanged={passwordChanged}
          profileCompleted={profileCompleted}
        />
      )}

      {/* Tabs underline — mesmo código existente */}
      ...
    </div>
  )
}
```

Importar `OnboardingChecklist` no topo.

- [ ] **Step 4: Rodar build**

```bash
npm run build
```
Esperado: `✓ Compiled successfully`

- [ ] **Step 5: Rodar todos os testes**

```bash
npx vitest run
```
Esperado: 84+ testes passando.

- [ ] **Step 6: Commit**

```bash
git add src/app/(app)/configuracoes/
git commit -m "feat: onboarding checklist em /configuracoes com redirect para dashboard ao concluir"
```

---

### Task 7: Redirect automático para dashboard após concluir onboarding

**Files:**
- Modify: `src/app/(app)/configuracoes/tabs/TabPerfil.tsx`
- Modify: `src/app/(app)/configuracoes/tabs/TabSeguranca.tsx`

- [ ] **Step 1: `TabSeguranca` — após troca de senha, recarregar a página**

No `onSubmit` de `TabSeguranca`, após o `promise` resolver com sucesso:
```ts
.then(async (res) => {
  if (!res.ok) { ... }
  reset()
  // Recarrega para que o Server Component re-avalie o checklist
  window.location.reload()
})
```

- [ ] **Step 2: `TabPerfil` — após salvar perfil com campos completos, recarregar**

No `onSubmit` de `TabPerfil`:
```ts
const res = await fetch('/api/users/me', { method: 'PATCH', ... })
if (!res.ok) throw new Error('Erro ao salvar')
const data = await res.json()
// Se onboarding concluído, recarrega para Server Component re-avaliar
if (data.onboardingCompleted) {
  window.location.reload()
}
```

> **Nota:** `window.location.reload()` força o Server Component a re-executar o guard. Se ambas as etapas estiverem completas, o checklist mostra "Acessar plataforma". O guard no layout não redireciona de `/configuracoes`, então o usuário clica no botão para ir ao dashboard.

- [ ] **Step 3: Rodar build + testes finais**

```bash
npx vitest run && npm run build
```
Esperado: todos os testes passando + build OK.

- [ ] **Step 4: Commit final**

```bash
git add src/app/(app)/configuracoes/tabs/
git commit -m "feat: reload após salvar para atualizar checklist de onboarding"
```

---

## Resumo do fluxo após implementação

```
Admin aprova solicitação
  → cria usuário: plan_selected=true, plan_id='experimental', password_is_temp=true, onboarding_completed=false

Usuário loga
  → guard detecta password_is_temp=true → redirect /configuracoes
  → checklist mostra: ✅ Plano ativado | ⬜ Trocar senha | ⬜ Completar perfil

Usuário troca senha
  → PATCH /api/users/me → password_is_temp=false
  → reload → checklist: ✅ Plano ativado | ✅ Trocar senha | ⬜ Completar perfil

Usuário preenche especialidade + CRM
  → PATCH /api/users/me → onboarding_completed=true
  → reload → checklist: ✅ ✅ ✅ → botão "Acessar plataforma" aparece

Usuário clica "Acessar plataforma"
  → /dashboard → guard passa (password_is_temp=false + onboarding_completed=true)
  → acesso total com plano Experimental ativo
```
