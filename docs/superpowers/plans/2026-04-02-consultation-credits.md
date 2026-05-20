# Consultation Credits — Credit Guard & Real-Time Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verificar e debitar créditos ao iniciar atendimento, estornar se abandonado antes de criar paciente, e exibir créditos em tempo real na Topbar.

**Architecture:** Guard no Server Component `consultation/page.tsx` que passa `hasCredits` para um client button. O debit ocorre no clique, antes de navegar. `AppContext` ganha `refreshCredits()` para atualizar o chip na Topbar em tempo real.

**Tech Stack:** Next.js App Router · React 19 · TypeScript · Supabase · Sonner toasts · Vitest

---

## File Map

| Arquivo | Ação |
|---|---|
| `src/app/api/auth/me/credit/route.ts` | Criar — POST +1 crédito (estorno) |
| `src/context/app-context.tsx` | Modificar — adicionar `refreshCredits()` |
| `src/components/dashboard/no-credits-modal.tsx` | Criar — modal portal "sem créditos" |
| `src/components/dashboard/new-consultation-button.tsx` | Criar — client button com debit + modal |
| `src/app/(app)/consultation/page.tsx` | Modificar — busca credits server-side, usa `NewConsultationButton` |
| `src/components/layout/Topbar.tsx` | Modificar — adicionar prop `credits` e chip visual |
| `src/app/(app)/app-layout-client.tsx` | Modificar — passa `credits` do contexto para `Topbar` |
| `src/app/(app)/consultation/novo/page.tsx` | Modificar — lógica de estorno via sessionStorage |

---

## Task 1: POST /api/auth/me/credit — Rota de Estorno

**Files:**
- Create: `src/app/api/auth/me/credit/route.ts`

- [ ] **Step 1: Escrever o teste**

Criar `src/app/api/auth/me/credit/route.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { credits_remaining: 2 }, error: null }),
  },
}))

vi.mock('@/server/services/auth', () => ({
  verifyToken: vi.fn().mockResolvedValue({ sub: 'user-1', name: 'Test', email: 'a@a.com', role: 'user' }),
  COOKIE_NAME: 'anamnese_auth',
}))

describe('POST /api/auth/me/credit', () => {
  it('returns 401 when no token', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/auth/me/credit', { method: 'POST' })
    // @ts-ignore
    const res = await POST(req)
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Rodar o teste para confirmar falha**

```bash
cd d:/REPOS-GITHUB-PARTICULAR/project-anamnese-ia-claude-code-repo-local
npx vitest run src/app/api/auth/me/credit/route.test.ts
```

Esperado: FAIL — arquivo não existe.

- [ ] **Step 3: Criar a rota**

Criar `src/app/api/auth/me/credit/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/server/services/auth'
import { CreditRepository } from '@/server/repositories/credits'

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  const payload = token ? await verifyToken(token) : null

  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const current = await CreditRepository.getCredits(payload.sub)
  await CreditRepository.setCredits(payload.sub, current + 1)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Rodar o teste**

```bash
npx vitest run src/app/api/auth/me/credit/route.test.ts
```

Esperado: PASS

- [ ] **Step 5: Adicionar rota em routes.ts**

Em `src/lib/routes.ts`, adicionar dentro do objeto `API`:

```typescript
meCredit:    '/api/auth/me/credit',
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/auth/me/credit/route.ts src/app/api/auth/me/credit/route.test.ts src/lib/routes.ts
git commit -m "feat: add POST /api/auth/me/credit — credit refund endpoint"
```

---

## Task 2: AppContext — refreshCredits()

**Files:**
- Modify: `src/context/app-context.tsx`

- [ ] **Step 1: Atualizar AppContext**

Substituir o conteúdo de `src/context/app-context.tsx`:

```typescript
'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import type { User } from '@/types'

interface AppContextValue {
  user: User | null
  credits: number
  refreshCredits: () => Promise<void>
  logout: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

interface AppProviderProps {
  children: ReactNode
  initialUser?: User | null
  initialCredits?: number
}

export function AppProvider({ children, initialUser = null, initialCredits = 0 }: AppProviderProps) {
  const [user] = useState<User | null>(initialUser)
  const [credits, setCredits] = useState<number>(initialCredits)

  const refreshCredits = useCallback(async () => {
    const res = await fetch('/api/auth/me')
    if (!res.ok) return
    const data = await res.json()
    if (typeof data.credits === 'number') setCredits(data.credits)
  }, [])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <AppContext.Provider value={{ user, credits, refreshCredits, logout }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}
```

> Nota: `debitCredit` foi removido do contexto — o debit agora é feito diretamente em `NewConsultationButton` via fetch, e `refreshCredits()` atualiza o saldo.

- [ ] **Step 2: Verificar que GET /api/auth/me retorna `credits`**

Abrir `src/app/api/auth/me/route.ts` e confirmar que a resposta inclui `credits`. Se não incluir, adicionar o campo ao JSON de retorno.

- [ ] **Step 3: Rodar todos os testes existentes**

```bash
npx vitest run
```

Esperado: todos passando (90+). Se algum usa `debitCredit` do contexto, atualizar o mock.

- [ ] **Step 4: Commit**

```bash
git add src/context/app-context.tsx
git commit -m "feat: add refreshCredits() to AppContext, remove debitCredit"
```

---

## Task 3: NoCreditsModal

**Files:**
- Create: `src/components/dashboard/no-credits-modal.tsx`

- [ ] **Step 1: Criar o componente**

Criar `src/components/dashboard/no-credits-modal.tsx`:

```typescript
'use client'

import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { X, ArrowRight } from 'lucide-react'
import { ROUTES } from '@/lib/routes'

interface NoCreditsModalProps {
  open: boolean
  onClose: () => void
}

export function NoCreditsModal({ open, onClose }: NoCreditsModalProps) {
  const router = useRouter()

  if (!open) return null

  function handleGoToPlans() {
    onClose()
    router.push(ROUTES.planos)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: 'oklch(0.14 0.05 285)', border: '1px solid rgba(124,58,237,0.25)' }}
      >
        {/* Fechar */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="relative px-6 pt-8 pb-6 text-center overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(239,68,68,0.12) 0%, transparent 70%)' }}
          />
          <div
            className="relative inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', boxShadow: '0 0 24px rgba(124,58,237,0.3)' }}
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="nocredits-spark" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#A78BFA" />
                  <stop offset="100%" stopColor="#22D3EE" />
                </linearGradient>
              </defs>
              <line x1="14" y1="2"    x2="14" y2="8"    stroke="url(#nocredits-spark)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="14" y1="20"   x2="14" y2="26"   stroke="url(#nocredits-spark)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="2"  y1="14"   x2="8"  y2="14"   stroke="url(#nocredits-spark)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="20" y1="14"   x2="26" y2="14"   stroke="url(#nocredits-spark)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="5.5"  y1="5.5"  x2="9.5"  y2="9.5"  stroke="url(#nocredits-spark)" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.8" />
              <line x1="18.5" y1="18.5" x2="22.5" y2="22.5" stroke="url(#nocredits-spark)" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.8" />
              <line x1="22.5" y1="5.5"  x2="18.5" y2="9.5"  stroke="url(#nocredits-spark)" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.8" />
              <line x1="5.5"  y1="22.5" x2="9.5"  y2="18.5" stroke="url(#nocredits-spark)" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.8" />
              <circle cx="14" cy="14" r="1.8" fill="url(#nocredits-spark)" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-1">
            Seus créditos acabaram
          </h2>
          <p className="text-sm text-muted-foreground">
            Você não possui créditos disponíveis para iniciar um novo atendimento. Faça upgrade do seu plano para continuar.
          </p>
        </div>

        {/* Ações */}
        <div className="px-6 pb-6 flex flex-col gap-2">
          <button
            onClick={handleGoToPlans}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-lg text-sm font-medium text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #06B6D4)', boxShadow: '0 0 20px rgba(124,58,237,0.4)' }}
          >
            Ver planos
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="w-full h-10 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/no-credits-modal.tsx
git commit -m "feat: add NoCreditsModal component"
```

---

## Task 4: NewConsultationButton

**Files:**
- Create: `src/components/dashboard/new-consultation-button.tsx`

- [ ] **Step 1: Criar o componente**

Criar `src/components/dashboard/new-consultation-button.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useApp } from '@/context/app-context'
import { NoCreditsModal } from './no-credits-modal'
import { API, ROUTES } from '@/lib/routes'

interface NewConsultationButtonProps {
  hasCredits: boolean
}

export function NewConsultationButton({ hasCredits }: NewConsultationButtonProps) {
  const router = useRouter()
  const { credits, refreshCredits } = useApp()
  const [processing, setProcessing] = useState(false)
  const [showNoCredits, setShowNoCredits] = useState(false)

  // Usa credits do contexto (pode ter sido atualizado) ou fallback da prop server
  const canStart = credits > 0 || hasCredits

  async function handleClick() {
    if (!canStart) {
      setShowNoCredits(true)
      return
    }

    setProcessing(true)

    const promise = fetch(API.meDebit, { method: 'POST' }).then(async (res) => {
      if (!res.ok) throw new Error('Erro ao processar crédito')
    })

    toast.promise(promise, {
      loading: 'Aguarde...',
      success: () => {
        const remaining = Math.max(0, credits - 1)
        return `1 crédito utilizado (restam ${remaining})`
      },
      error: 'Erro ao processar crédito. Tente novamente.',
    })

    await promise.catch(() => { setProcessing(false) })

    sessionStorage.setItem('consultation_debit_pending', '1')
    await refreshCredits()
    setProcessing(false)
    router.push(ROUTES.atendimentoNovo)
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={processing}
        className="flex items-center gap-2 h-9 px-4 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {processing ? 'Aguarde...' : '+ Novo atendimento'}
      </button>

      <NoCreditsModal
        open={showNoCredits}
        onClose={() => setShowNoCredits(false)}
      />
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/new-consultation-button.tsx
git commit -m "feat: add NewConsultationButton with debit logic and NoCreditsModal"
```

---

## Task 5: consultation/page.tsx — Credit Guard Server-Side

**Files:**
- Modify: `src/app/(app)/consultation/page.tsx`

- [ ] **Step 1: Atualizar a página**

Substituir o conteúdo de `src/app/(app)/consultation/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { getServerUser } from '@/server/services/session'
import { CreditRepository } from '@/server/repositories/credits'
import { ROUTES } from '@/lib/routes'
import { PageHeader } from '@/components/console/page-header'
import { Stethoscope } from 'lucide-react'
import { NewConsultationButton } from '@/components/dashboard/new-consultation-button'

export const dynamic = 'force-dynamic'

export default async function AtendimentoPage() {
  const user = await getServerUser()
  if (!user) redirect(ROUTES.login)

  const credits = await CreditRepository.getCredits(user.id)
  const hasCredits = credits > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Atendimento"
        description="Inicie ou continue um atendimento clínico."
        action={<NewConsultationButton hasCredits={hasCredits} />}
      />

      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)' }}>
          <Stethoscope className="h-7 w-7 text-violet-400" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">Nenhum atendimento ainda</p>
        <p className="text-xs text-muted-foreground mb-4">Inicie um novo atendimento para começar.</p>
        <NewConsultationButton hasCredits={hasCredits} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(app)/consultation/page.tsx
git commit -m "feat: consultation page fetches credits server-side, uses NewConsultationButton"
```

---

## Task 6: Topbar — Chip de Créditos

**Files:**
- Modify: `src/components/layout/Topbar.tsx`
- Modify: `src/app/(app)/app-layout-client.tsx`

- [ ] **Step 1: Adicionar prop `credits` e chip na Topbar**

Substituir o conteúdo de `src/components/layout/Topbar.tsx`:

```typescript
'use client'

import Link from 'next/link'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Logo } from '@/components/ui/logo'

export interface TopbarUser {
  initials: string
  name: string
  subtitle: string
}

interface TopbarProps {
  user?: TopbarUser
  credits?: number
  onLogout?: () => void
  left?: React.ReactNode
  right?: React.ReactNode
  menuItems?: { label: string; href: string }[]
}

function CreditsChip({ credits }: { credits: number }) {
  const color =
    credits === 0
      ? 'text-destructive'
      : credits <= 3
        ? 'text-amber-400'
        : 'text-muted-foreground'

  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${color}`}>
      <span style={{ fontSize: '10px' }}>✦</span>
      {credits}
    </span>
  )
}

export function Topbar({ user, credits, onLogout, left, right, menuItems }: TopbarProps) {
  return (
    <header className="h-14 border-b border-border bg-card fixed top-0 left-0 right-0 z-40 flex items-center px-4 gap-4">
      {left}

      <Link href="/" className="flex items-center">
        <Logo size="sm" id="topbar" />
      </Link>

      <div className="flex-1" />

      {right}

      {typeof credits === 'number' && <CreditsChip credits={credits} />}

      {user && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-secondary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Menu do usuário"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback
                  className="text-xs font-semibold text-violet-900"
                  style={{ background: 'linear-gradient(135deg, #A78BFA, #22D3EE)' }}
                >
                  {user.initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-foreground leading-tight">{user.name}</p>
                <p className="text-xs leading-tight" style={{ color: '#22D3EE', opacity: 0.8 }}>{user.subtitle}</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium leading-none">{user.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{user.subtitle}</p>
            </div>
            {menuItems && menuItems.length > 0 && (
              <>
                <DropdownMenuSeparator />
                {menuItems.map((item) => (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link href={item.href}>{item.label}</Link>
                  </DropdownMenuItem>
                ))}
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onLogout}>
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  )
}
```

- [ ] **Step 2: Passar `credits` do AppContext para a Topbar em `app-layout-client.tsx`**

Em `src/app/(app)/app-layout-client.tsx`, atualizar a função `AppShell` para ler `credits` do contexto e passar para `Topbar`:

```typescript
function AppShell({ children, isOnboarding }: { children: React.ReactNode; isOnboarding: boolean }) {
  const { user, credits, logout } = useApp()

  const topbarUser = {
    initials: user?.initials ?? '...',
    name: user?.name ? abbreviateName(user.name) : '',
    subtitle: user?.specialty ?? '',
  }

  return (
    <>
      <Topbar
        user={topbarUser}
        credits={isOnboarding ? undefined : credits}
        onLogout={logout}
        menuItems={isOnboarding ? [] : MENU_ITEMS}
        left={isOnboarding ? null : <MobileSidebar navItems={NAV_ITEMS} />}
      />
      <div className="flex h-screen pt-14">
        {!isOnboarding && (
          <div className="hidden md:flex shrink-0">
            <Sidebar navItems={NAV_ITEMS} />
          </div>
        )}
        <main className="flex-1 overflow-y-auto">
          <div className="container max-w-5xl mx-auto px-4 py-6">
            {children}
          </div>
        </main>
      </div>
    </>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Topbar.tsx src/app/(app)/app-layout-client.tsx
git commit -m "feat: add credits chip to Topbar, real-time via AppContext"
```

---

## Task 7: consultation/novo — Estorno de Crédito

**Files:**
- Modify: `src/app/(app)/consultation/novo/page.tsx`

- [ ] **Step 1: Adicionar lógica de estorno**

Substituir o conteúdo de `src/app/(app)/consultation/novo/page.tsx`:

```typescript
'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { usePatients } from '@/hooks/use-patients'
import { useApp } from '@/context/app-context'
import { formatCPF } from '@/lib/utils'
import { patientSchema, type PatientFormData } from '@/lib/schemas'
import { API, ROUTES } from '@/lib/routes'

const DEBIT_KEY = 'consultation_debit_pending'

export default function NovoPacientePage() {
  const router = useRouter()
  const { createPatient } = usePatients()
  const { refreshCredits } = useApp()
  const refunded = useRef(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    mode: 'onTouched',
  })

  const cpfValue = watch('cpf') ?? ''

  // Estorno ao sair sem criar paciente
  useEffect(() => {
    return () => {
      if (refunded.current) return
      if (!sessionStorage.getItem(DEBIT_KEY)) return
      refunded.current = true
      sessionStorage.removeItem(DEBIT_KEY)
      fetch(API.meCredit, { method: 'POST' }).then(() => {
        refreshCredits()
        toast.info('Crédito estornado')
      })
    }
  }, [refreshCredits])

  async function onSubmit(data: PatientFormData) {
    const patient = await createPatient({
      name: data.name,
      cpf: data.cpf,
      birthDate: data.birthDate || undefined,
      phone: data.phone || undefined,
    })
    // Paciente criado com sucesso — remove flag, sem estorno
    refunded.current = true
    sessionStorage.removeItem(DEBIT_KEY)
    router.push(ROUTES.atendimentoId(patient.id))
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={ROUTES.atendimento} className="text-sm text-primary hover:underline">← Voltar</Link>
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
                name="cpf"
                ref={register('cpf').ref}
                onBlur={register('cpf').onBlur}
                value={cpfValue}
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
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Aguarde...' : 'Salvar e iniciar atendimento'}
              </Button>
              <Link href={ROUTES.atendimento}>
                <Button type="button" variant="ghost">Cancelar</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Adicionar `meCredit` em routes.ts** (se ainda não adicionado na Task 1)

Verificar que `src/lib/routes.ts` tem:
```typescript
meCredit:    '/api/auth/me/credit',
```

- [ ] **Step 3: Rodar todos os testes**

```bash
npx vitest run
```

Esperado: todos passando.

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/consultation/novo/page.tsx
git commit -m "feat: refund credit on abandon in consultation/novo"
```

---

## Task 8: Remover debitCredit do [id]/page.tsx

**Files:**
- Modify: `src/app/(app)/consultation/[id]/page.tsx`

O debit agora ocorre antes de entrar no fluxo. A chamada `POST /api/auth/me/debit` que estava no `handleComplete` deve ser removida para não debitar duas vezes.

- [ ] **Step 1: Remover o debit do handleComplete**

Em `src/app/(app)/consultation/[id]/page.tsx`, atualizar `handleComplete`:

```typescript
async function handleComplete(consultationId: string) {
  router.push(ROUTES.resultado(consultationId))
}
```

- [ ] **Step 2: Rodar os testes**

```bash
npx vitest run
```

Esperado: todos passando.

- [ ] **Step 3: Commit final**

```bash
git add src/app/(app)/consultation/[id]/page.tsx
git commit -m "feat: remove double debit from consultation handleComplete"
```

---

## Self-Review

**Spec coverage:**
- ✅ Guard server-side com `hasCredits` — Task 5
- ✅ `NoCreditsModal` com portal, sem fechar ao clicar fora, logo, botão Ver planos — Task 3
- ✅ Debit no início com `toast.promise` — Task 4
- ✅ `refreshCredits()` no AppContext — Task 2
- ✅ Chip na Topbar com cores por faixa de créditos — Task 6
- ✅ Estorno via sessionStorage ao sair de /consultation/novo — Task 7
- ✅ Rota POST /api/auth/me/credit — Task 1
- ✅ Remover debit duplicado do handleComplete — Task 8

**Consistência de tipos:**
- `API.meCredit` adicionado na Task 1 e usado na Task 7 ✅
- `refreshCredits()` definido na Task 2 e consumido nas Tasks 4 e 7 ✅
- `credits` prop na Topbar definida na Task 6, passada na Task 6 ✅
