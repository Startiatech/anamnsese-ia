# Dashboard Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an authenticated app layout with sidebar navigation, topbar with avatar dropdown, mobile drawer, and a functional dashboard page — including a credits system, weekly activity chart, and recent activity feed.

**Architecture:** Route group `(app)` wraps all authenticated pages under a shared layout (Topbar + Sidebar). The layout is a Client Component managing mobile sidebar open state. AppContext provides mock user + credits to the entire app. Credits are stored in localStorage (SSR-safe). All existing pages are moved into the `(app)` route group.

**Tech Stack:** Next.js 14 App Router · TypeScript · Tailwind CSS · shadcn/ui (sheet, dropdown-menu, avatar) · lucide-react · Vitest + React Testing Library

---

## Prerequisites

### Step 0 — Install shadcn components

- [ ] Run the following command from the project root:

```bash
cd "d:\REPOS-GITHUB-PARTICULAR\project-anamnese-ia-claude-code-repo-local" && npx shadcn@latest add sheet dropdown-menu avatar --yes
```

Expected output (lines may vary in order):
```
✔ Installing dependencies...
✔ Created src/components/ui/sheet.tsx
✔ Created src/components/ui/dropdown-menu.tsx
✔ Created src/components/ui/avatar.tsx
Done.
```

Verify:
```bash
ls src/components/ui/sheet.tsx src/components/ui/dropdown-menu.tsx src/components/ui/avatar.tsx
```

---

## Phase 1 — Foundation (types, lib, context)

### Step 1 — Add `User` type to `src/types/index.ts`

- [ ] Open `src/types/index.ts` and append at the end:

```typescript
// ─── User ────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  name: string
  crm: string
  specialty: string
  initials: string
}
```

### Step 2 — Create `src/lib/mock/user.ts`

- [ ] Create file `src/lib/mock/user.ts`:

```typescript
import type { User } from '@/types'

export const MOCK_USER: User = {
  id: 'mock-user-1',
  name: 'Dr. João Silva',
  crm: '12345/SP',
  specialty: 'Clínica Geral',
  initials: 'JS',
}
```

### Step 3 — Write tests for `CreditRepository`

- [ ] Create file `src/lib/credits.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

// We test the module in a jsdom environment where localStorage is available.
// Reset localStorage before each test to guarantee isolation.

describe('CreditRepository', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('returns default value (50) when no key exists in localStorage', async () => {
    const { CreditRepository } = await import('./credits')
    const repo = new CreditRepository()
    expect(repo.getCredits()).toBe(50)
  })

  it('persists initial credits to localStorage on first read', async () => {
    const { CreditRepository } = await import('./credits')
    const repo = new CreditRepository()
    repo.getCredits()
    expect(localStorage.getItem('anamnese_credits')).toBe('50')
  })

  it('debitCredit decrements credits by 1', async () => {
    const { CreditRepository } = await import('./credits')
    const repo = new CreditRepository()
    repo.getCredits() // initialise
    repo.debitCredit()
    expect(repo.getCredits()).toBe(49)
  })

  it('debitCredit does not go below 0', async () => {
    const { CreditRepository } = await import('./credits')
    const repo = new CreditRepository()
    localStorage.setItem('anamnese_credits', '0')
    repo.debitCredit()
    expect(repo.getCredits()).toBe(0)
  })

  it('setCredits stores arbitrary value', async () => {
    const { CreditRepository } = await import('./credits')
    const repo = new CreditRepository()
    repo.setCredits(100)
    expect(repo.getCredits()).toBe(100)
  })

  it('resetCredits restores default 50', async () => {
    const { CreditRepository } = await import('./credits')
    const repo = new CreditRepository()
    repo.setCredits(5)
    repo.resetCredits()
    expect(repo.getCredits()).toBe(50)
  })
})
```

Run (expect all failures — red):
```bash
cd "d:\REPOS-GITHUB-PARTICULAR\project-anamnese-ia-claude-code-repo-local" && npx vitest run src/lib/credits.test.ts 2>&1 | tail -20
```

### Step 4 — Implement `src/lib/credits.ts`

- [ ] Create file `src/lib/credits.ts`:

```typescript
const CREDITS_KEY = 'anamnese_credits'
const DEFAULT_CREDITS = 50

export class CreditRepository {
  private key = CREDITS_KEY

  getCredits(): number {
    if (typeof window === 'undefined') return DEFAULT_CREDITS
    const raw = localStorage.getItem(this.key)
    if (raw === null) {
      localStorage.setItem(this.key, String(DEFAULT_CREDITS))
      return DEFAULT_CREDITS
    }
    const parsed = parseInt(raw, 10)
    return isNaN(parsed) ? DEFAULT_CREDITS : parsed
  }

  setCredits(value: number): void {
    if (typeof window === 'undefined') return
    localStorage.setItem(this.key, String(Math.max(0, value)))
  }

  debitCredit(): void {
    const current = this.getCredits()
    if (current > 0) {
      this.setCredits(current - 1)
    }
  }

  resetCredits(): void {
    this.setCredits(DEFAULT_CREDITS)
  }
}

export const creditRepository = new CreditRepository()
```

Run (expect all pass — green):
```bash
cd "d:\REPOS-GITHUB-PARTICULAR\project-anamnese-ia-claude-code-repo-local" && npx vitest run src/lib/credits.test.ts 2>&1 | tail -10
```

Expected:
```
 ✓ src/lib/credits.test.ts (6)
 Test Files  1 passed (1)
```

### Step 5 — Write tests for `AppContext`

- [ ] Create file `src/context/AppContext.test.tsx`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { AppProvider, useApp } from './AppContext'

// Helper component that reads from context and renders values
function Consumer() {
  const { user, credits, debitCredit } = useApp()
  return (
    <div>
      <span data-testid="user-name">{user.name}</span>
      <span data-testid="user-initials">{user.initials}</span>
      <span data-testid="credits">{credits}</span>
      <button onClick={debitCredit} data-testid="debit-btn">
        Debit
      </button>
    </div>
  )
}

describe('AppContext', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('provides mock user name and initials', () => {
    render(
      <AppProvider>
        <Consumer />
      </AppProvider>
    )
    expect(screen.getByTestId('user-name').textContent).toBe('Dr. João Silva')
    expect(screen.getByTestId('user-initials').textContent).toBe('JS')
  })

  it('provides credits with default value 50', async () => {
    render(
      <AppProvider>
        <Consumer />
      </AppProvider>
    )
    // Credits load in useEffect — wait for re-render
    await screen.findByText('50', { selector: '[data-testid="credits"]' })
  })

  it('debitCredit decrements credits by 1', async () => {
    render(
      <AppProvider>
        <Consumer />
      </AppProvider>
    )
    await screen.findByText('50', { selector: '[data-testid="credits"]' })
    act(() => {
      screen.getByTestId('debit-btn').click()
    })
    await screen.findByText('49', { selector: '[data-testid="credits"]' })
  })
})
```

Run (expect failures — red):
```bash
cd "d:\REPOS-GITHUB-PARTICULAR\project-anamnese-ia-claude-code-repo-local" && npx vitest run src/context/AppContext.test.tsx 2>&1 | tail -20
```

### Step 6 — Implement `src/context/AppContext.tsx`

- [ ] Create file `src/context/AppContext.tsx`:

```typescript
'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import type { User } from '@/types'
import { MOCK_USER } from '@/lib/mock/user'
import { CreditRepository } from '@/lib/credits'

// Single repository instance shared across the context lifetime
const creditRepo = new CreditRepository()

interface AppContextValue {
  user: User
  credits: number
  debitCredit: () => void
  refreshCredits: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  // Default to 50 to avoid hydration mismatch; real value loaded in useEffect
  const [credits, setCredits] = useState<number>(50)

  useEffect(() => {
    setCredits(creditRepo.getCredits())
  }, [])

  // useCallback is required — inline arrow functions in context values
  // cause infinite loops when consumers use them in useEffect deps.
  const debitCredit = useCallback(() => {
    creditRepo.debitCredit()
    setCredits(creditRepo.getCredits())
  }, [])

  const refreshCredits = useCallback(() => {
    setCredits(creditRepo.getCredits())
  }, [])

  return (
    <AppContext.Provider value={{ user: MOCK_USER, credits, debitCredit, refreshCredits }}>
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

Run (expect all pass — green):
```bash
cd "d:\REPOS-GITHUB-PARTICULAR\project-anamnese-ia-claude-code-repo-local" && npx vitest run src/context/AppContext.test.tsx 2>&1 | tail -10
```

Expected:
```
 ✓ src/context/AppContext.test.tsx (3)
 Test Files  1 passed (1)
```

### Step 7 — Commit Phase 1

```bash
cd "d:\REPOS-GITHUB-PARTICULAR\project-anamnese-ia-claude-code-repo-local" && git add src/types/index.ts src/lib/mock/user.ts src/lib/credits.ts src/lib/credits.test.ts src/context/AppContext.tsx src/context/AppContext.test.tsx && git commit -m "feat: add User type, CreditRepository, and AppContext"
```

---

## Phase 2 — Layout components

### Step 8 — Write tests for `WeeklyChart`

- [ ] Create file `src/components/dashboard/WeeklyChart.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WeeklyChart } from './WeeklyChart'
import type { Consultation } from '@/types'

// Fix "today" to a known Wednesday (2026-03-25) so the week is deterministic.
// Mon 2026-03-23 … Sun 2026-03-29
beforeAll(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-03-25T10:00:00'))
})

function makeConsultation(dateStr: string): Consultation {
  return {
    id: dateStr,
    patientId: 'p1',
    status: 'completed',
    createdAt: dateStr,
    updatedAt: dateStr,
    sections: [],
    structuredAnamnesis: null,
    transcription: null,
    audioUrl: null,
  } as unknown as Consultation
}

describe('WeeklyChart', () => {
  it('renders exactly 7 day bars', () => {
    render(<WeeklyChart consultations={[]} />)
    const bars = screen.getAllByRole('img', { hidden: true })
    // We query by a test-id pattern instead
    const dayColumns = screen.getAllByTestId(/^day-col-/)
    expect(dayColumns).toHaveLength(7)
  })

  it('renders the correct day labels Mon through Sun', () => {
    render(<WeeklyChart consultations={[]} />)
    const labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
    labels.forEach((label) => {
      expect(screen.getByText(label)).toBeTruthy()
    })
  })

  it('shows count label for a day that has consultations', () => {
    // 2026-03-23 is Monday of the fixed week
    const consultations = [
      makeConsultation('2026-03-23T09:00:00'),
      makeConsultation('2026-03-23T14:00:00'),
    ]
    render(<WeeklyChart consultations={consultations} />)
    // The count badge for Monday should show "2"
    expect(screen.getByTestId('day-count-0').textContent).toBe('2')
  })

  it('shows 0 count label for empty days', () => {
    render(<WeeklyChart consultations={[]} />)
    const countEl = screen.getByTestId('day-count-0')
    expect(countEl.textContent).toBe('0')
  })
})
```

Run (expect failures — red):
```bash
cd "d:\REPOS-GITHUB-PARTICULAR\project-anamnese-ia-claude-code-repo-local" && npx vitest run src/components/dashboard/WeeklyChart.test.tsx 2>&1 | tail -20
```

### Step 9 — Implement `src/components/dashboard/WeeklyChart.tsx`

- [ ] Create directory `src/components/dashboard/` if it does not exist.
- [ ] Create file `src/components/dashboard/WeeklyChart.tsx`:

```typescript
'use client'

import type { Consultation } from '@/types'

interface WeeklyChartProps {
  consultations: Consultation[]
}

const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

/**
 * Returns the ISO Monday of the week that contains `date`.
 * Monday = index 0, Sunday = index 6.
 */
function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0 = Sunday
  // Convert to Mon=0 … Sun=6
  const diff = (day === 0 ? -6 : 1 - day)
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10) // YYYY-MM-DD
}

export function WeeklyChart({ consultations }: WeeklyChartProps) {
  const today = new Date()
  const monday = getMondayOfWeek(today)

  // Build array of 7 dates: Mon … Sun
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })

  // Count consultations per day using YYYY-MM-DD key
  const countByDay: Record<string, number> = {}
  for (const c of consultations) {
    const key = (c.createdAt ?? '').slice(0, 10)
    if (key) countByDay[key] = (countByDay[key] ?? 0) + 1
  }

  const counts = weekDays.map((d) => countByDay[toDateString(d)] ?? 0)
  const maxCount = Math.max(...counts, 1) // avoid division by zero

  const todayStr = toDateString(today)

  return (
    <div className="flex items-end gap-2 h-28 w-full">
      {weekDays.map((day, i) => {
        const count = counts[i]
        const heightPct = Math.round((count / maxCount) * 100)
        const isToday = toDateString(day) === todayStr
        const barHeight = `${Math.max(heightPct, 4)}%`

        return (
          <div
            key={i}
            data-testid={`day-col-${i}`}
            className="flex flex-col items-center flex-1 gap-1"
          >
            {/* Count label */}
            <span
              data-testid={`day-count-${i}`}
              className="text-xs text-muted-foreground leading-none"
            >
              {count}
            </span>

            {/* Bar */}
            <div className="w-full flex items-end" style={{ height: '72px' }}>
              <div
                className={`w-full rounded-t transition-all ${
                  isToday
                    ? 'bg-primary'
                    : 'bg-primary/30'
                }`}
                style={{ height: barHeight }}
              />
            </div>

            {/* Day label */}
            <span
              className={`text-xs leading-none ${
                isToday ? 'font-semibold text-primary' : 'text-muted-foreground'
              }`}
            >
              {DAY_LABELS[i]}
            </span>
          </div>
        )
      })}
    </div>
  )
}
```

Run (expect all pass — green):
```bash
cd "d:\REPOS-GITHUB-PARTICULAR\project-anamnese-ia-claude-code-repo-local" && npx vitest run src/components/dashboard/WeeklyChart.test.tsx 2>&1 | tail -10
```

Expected:
```
 ✓ src/components/dashboard/WeeklyChart.test.tsx (4)
 Test Files  1 passed (1)
```

### Step 10 — Create `src/components/layout/Sidebar.tsx`

- [ ] Create directory `src/components/layout/`.
- [ ] Create file `src/components/layout/Sidebar.tsx`:

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Stethoscope,
  ClipboardList,
  CreditCard,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/atendimento', label: 'Atendimento', icon: Stethoscope },
  { href: '/historico', label: 'Histórico', icon: ClipboardList },
  { href: '/planos', label: 'Planos', icon: CreditCard },
]

interface SidebarProps {
  onNavigate?: () => void
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="flex flex-col w-56 h-full bg-background border-r">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b shrink-0">
        <span className="font-bold text-lg tracking-tight">Anamnese IA</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
```

### Step 11 — Create `src/components/layout/MobileSidebar.tsx`

- [ ] Create file `src/components/layout/MobileSidebar.tsx`:

```typescript
'use client'

import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Menu } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { useState } from 'react'

export function MobileSidebar() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-56">
        <Sidebar onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}
```

### Step 12 — Create `src/components/layout/Topbar.tsx`

- [ ] Create file `src/components/layout/Topbar.tsx`:

```typescript
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { MobileSidebar } from './MobileSidebar'
import { useApp } from '@/context/AppContext'

export function Topbar() {
  const { user } = useApp()
  const router = useRouter()

  return (
    <header className="h-14 border-b bg-background fixed top-0 left-0 right-0 z-40 flex items-center px-4 gap-4">
      {/* Hamburger (mobile) */}
      <MobileSidebar />

      {/* Logo — shown on mobile when sidebar is hidden */}
      <span className="font-bold text-base tracking-tight md:hidden">
        Anamnese IA
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Avatar dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Menu do usuário"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs font-medium">
                {user.initials}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{user.specialty}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/perfil">Perfil</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/configuracoes">Configurações</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => router.push('/dashboard')}
          >
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
```

### Step 13 — Create dashboard sub-components

#### `src/components/dashboard/GreetingSection.tsx`

- [ ] Create file `src/components/dashboard/GreetingSection.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useApp } from '@/context/AppContext'

function getGreeting(hour: number): string {
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

interface GreetingSectionProps {
  weekCount: number
}

export function GreetingSection({ weekCount }: GreetingSectionProps) {
  const { user, credits } = useApp()
  // Avoid hydration mismatch: compute greeting client-side only
  const [greeting, setGreeting] = useState('')

  useEffect(() => {
    setGreeting(getGreeting(new Date().getHours()))
  }, [])

  const blocked = credits === 0

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting && `${greeting}, ${user.name}!`}
          {!greeting && `Olá, ${user.name}!`}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {weekCount === 0
            ? 'Nenhum atendimento esta semana.'
            : weekCount === 1
            ? '1 atendimento realizado esta semana.'
            : `${weekCount} atendimentos realizados esta semana.`}
        </p>
      </div>
      <Button asChild={!blocked} disabled={blocked} className="w-full sm:w-auto">
        {blocked ? (
          <span className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Novo Atendimento
          </span>
        ) : (
          <Link href="/atendimento" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Novo Atendimento
          </Link>
        )}
      </Button>
    </div>
  )
}
```

#### `src/components/dashboard/MetricsRow.tsx`

- [ ] Create file `src/components/dashboard/MetricsRow.tsx`:

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, CalendarCheck, TrendingUp, Coins } from 'lucide-react'

interface MetricsRowProps {
  totalPatients: number
  consultationsThisMonth: number
  consultationsThisWeek: number
  creditsRemaining: number
}

export function MetricsRow({
  totalPatients,
  consultationsThisMonth,
  consultationsThisWeek,
  creditsRemaining,
}: MetricsRowProps) {
  const metrics = [
    {
      title: 'Pacientes',
      value: totalPatients,
      icon: Users,
      description: 'total cadastrado',
    },
    {
      title: 'Este mês',
      value: consultationsThisMonth,
      icon: CalendarCheck,
      description: 'atendimentos',
    },
    {
      title: 'Esta semana',
      value: consultationsThisWeek,
      icon: TrendingUp,
      description: 'atendimentos',
    },
    {
      title: 'Créditos',
      value: creditsRemaining,
      icon: Coins,
      description: 'restantes',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((m) => (
        <Card key={m.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">{m.title}</CardTitle>
            <m.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{m.value}</div>
            <p className="text-xs text-muted-foreground">{m.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

#### `src/components/dashboard/CreditWidget.tsx`

- [ ] Create file `src/components/dashboard/CreditWidget.tsx`:

```typescript
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useApp } from '@/context/AppContext'

const MAX_CREDITS = 50

export function CreditWidget() {
  const { credits } = useApp()
  const pct = Math.round((credits / MAX_CREDITS) * 100)
  const low = credits < 10
  const empty = credits === 0

  return (
    <Card className={empty ? 'border-destructive' : low ? 'border-yellow-500' : ''}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium">Créditos disponíveis</CardTitle>
        {empty && (
          <Badge variant="destructive" className="text-xs">
            Sem créditos
          </Badge>
        )}
        {!empty && low && (
          <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">
            Poucos créditos
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end gap-2">
          <span className="text-3xl font-bold">{credits}</span>
          <span className="text-muted-foreground text-sm mb-1">/ {MAX_CREDITS}</span>
        </div>
        {/* CSS progress bar — no external lib */}
        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              empty
                ? 'bg-destructive'
                : low
                ? 'bg-yellow-500'
                : 'bg-primary'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {empty && (
          <p className="text-xs text-destructive">
            Adquira mais créditos para continuar realizando atendimentos.
          </p>
        )}
        {!empty && low && (
          <p className="text-xs text-yellow-600">
            Você está com poucos créditos restantes.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
```

#### `src/components/dashboard/RecentActivity.tsx`

- [ ] Create file `src/components/dashboard/RecentActivity.tsx`:

```typescript
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTime } from '@/lib/utils'
import type { Consultation, Patient } from '@/types'
import { ArrowRight } from 'lucide-react'

interface RecentActivityProps {
  consultations: Consultation[]
  patients: Patient[]
}

export function RecentActivity({ consultations, patients }: RecentActivityProps) {
  // Most recent first, cap at 5
  const recent = [...consultations]
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    .slice(0, 5)

  const patientMap = new Map(patients.map((p) => [p.id, p]))

  if (recent.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Atividade recente</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Nenhum atendimento ainda.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Atividade recente</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        {recent.map((c) => {
          const patient = patientMap.get(c.patientId)
          const name = patient?.name ?? 'Paciente desconhecido'
          return (
            <div key={c.id} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
              <div>
                <p className="text-sm font-medium">{name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.createdAt ? formatDateTime(c.createdAt) : '—'}
                </p>
              </div>
              {c.status === 'completed' && (
                <Link
                  href={`/resultado/${c.id}`}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Ver resultado
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
```

### Step 14 — Commit Phase 2

```bash
cd "d:\REPOS-GITHUB-PARTICULAR\project-anamnese-ia-claude-code-repo-local" && git add src/components/ && git commit -m "feat: add layout components (Sidebar, Topbar, MobileSidebar) and dashboard widgets"
```

---

## Phase 3 — App route group + pages

### Step 15 — Create `src/app/(app)/layout.tsx`

- [ ] Create directory `src/app/(app)/`.
- [ ] Create file `src/app/(app)/layout.tsx`:

```typescript
'use client'

import { AppProvider } from '@/context/AppContext'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      {/* Fixed topbar */}
      <Topbar />

      {/* Below topbar: sidebar + content */}
      <div className="flex h-screen pt-14">
        {/* Desktop sidebar — hidden on mobile */}
        <div className="hidden md:flex shrink-0">
          <Sidebar />
        </div>

        {/* Main scrollable content */}
        <main className="flex-1 overflow-y-auto">
          <div className="container max-w-5xl mx-auto px-4 py-6">
            {children}
          </div>
        </main>
      </div>
    </AppProvider>
  )
}
```

### Step 16 — Create `src/app/(app)/dashboard/page.tsx`

- [ ] Create directory `src/app/(app)/dashboard/`.
- [ ] Create file `src/app/(app)/dashboard/page.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { GreetingSection } from '@/components/dashboard/GreetingSection'
import { MetricsRow } from '@/components/dashboard/MetricsRow'
import { CreditWidget } from '@/components/dashboard/CreditWidget'
import { WeeklyChart } from '@/components/dashboard/WeeklyChart'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PatientRepository, ConsultationRepository } from '@/lib/db'
import { useApp } from '@/context/AppContext'
import type { Patient, Consultation } from '@/types'

const patientRepo = new PatientRepository()
const consultationRepo = new ConsultationRepository()

function getStartOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function getStartOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export default function DashboardPage() {
  const { credits } = useApp()
  const [patients, setPatients] = useState<Patient[]>([])
  const [consultations, setConsultations] = useState<Consultation[]>([])

  useEffect(() => {
    setPatients(patientRepo.findAll())
    setConsultations(consultationRepo.findAll())
  }, [])

  const now = new Date()
  const weekStart = getStartOfWeek(now)
  const monthStart = getStartOfMonth(now)

  const weekStartStr = weekStart.toISOString()
  const monthStartStr = monthStart.toISOString()

  const consultationsThisWeek = consultations.filter(
    (c) => (c.createdAt ?? '') >= weekStartStr
  ).length

  const consultationsThisMonth = consultations.filter(
    (c) => (c.createdAt ?? '') >= monthStartStr
  ).length

  const weekConsultations = consultations.filter(
    (c) => (c.createdAt ?? '') >= weekStartStr
  )

  return (
    <div className="space-y-6">
      <GreetingSection weekCount={consultationsThisWeek} />

      <MetricsRow
        totalPatients={patients.length}
        consultationsThisMonth={consultationsThisMonth}
        consultationsThisWeek={consultationsThisWeek}
        creditsRemaining={credits}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly chart — spans 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Atendimentos esta semana</CardTitle>
          </CardHeader>
          <CardContent>
            <WeeklyChart consultations={weekConsultations} />
          </CardContent>
        </Card>

        {/* Credits widget */}
        <CreditWidget />
      </div>

      <RecentActivity consultations={consultations} patients={patients} />
    </div>
  )
}
```

### Step 17 — Move existing pages into `(app)` route group

Each step below creates the new file at the `(app)` path and deletes the old one.

#### 17a — Atendimento (was /pacientes)

- [ ] Create directory `src/app/(app)/atendimento/`.
- [ ] Copy `src/app/pacientes/page.tsx` content to `src/app/(app)/atendimento/page.tsx`.
  - Update any `href` references from `/pacientes/novo` → `/atendimento/novo` and from `/atendimento/` → `/atendimento/`.
- [ ] Create directory `src/app/(app)/atendimento/novo/`.
- [ ] Copy `src/app/pacientes/novo/page.tsx` content to `src/app/(app)/atendimento/novo/page.tsx`.
  - Update `router.push` targets: on success push to `/atendimento/${id}` (not `/atendimento/${id}`).

#### 17b — Consultation flow (was /atendimento/[id])

- [ ] Create directory `src/app/(app)/atendimento/[id]/`.
- [ ] Copy `src/app/atendimento/[id]/page.tsx` content to `src/app/(app)/atendimento/[id]/page.tsx`.
- [ ] Add credit debit on consultation complete. In the `handleComplete` function, after `router.push(...)`, add:

```typescript
// Debit one credit when consultation is completed
import { creditRepository } from '@/lib/credits'
// … inside handleComplete, after router.push:
creditRepository.debitCredit()
```

  Full pattern for `handleComplete` (adjust to match the actual function signature):

```typescript
async function handleComplete() {
  // ... existing logic to save consultation ...
  router.push(`/resultado/${consultationId}`)
  creditRepository.debitCredit()
}
```

#### 17c — Resultado (was /resultado/[id])

- [ ] Create directory `src/app/(app)/resultado/[id]/`.
- [ ] Copy `src/app/resultado/[id]/page.tsx` content to `src/app/(app)/resultado/[id]/page.tsx`.
  - Update any back-links from `/pacientes` → `/atendimento`.

#### 17d — Delete old routes (after verifying new ones work)

```bash
cd "d:\REPOS-GITHUB-PARTICULAR\project-anamnese-ia-claude-code-repo-local" && rm -rf src/app/pacientes src/app/atendimento src/app/resultado
```

### Step 18 — Create placeholder pages

Each file below exports a minimal page component so Next.js does not throw 404s.

#### `src/app/(app)/historico/page.tsx`

- [ ] Create file:

```typescript
export default function HistoricoPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Histórico</h1>
      <p className="text-muted-foreground">Em breve: listagem completa de atendimentos.</p>
    </div>
  )
}
```

#### `src/app/(app)/planos/page.tsx`

- [ ] Create file:

```typescript
export default function PlanosPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Planos</h1>
      <p className="text-muted-foreground">Em breve: planos e cobrança.</p>
    </div>
  )
}
```

#### `src/app/(app)/perfil/page.tsx`

- [ ] Create file:

```typescript
export default function PerfilPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Perfil</h1>
      <p className="text-muted-foreground">Em breve: edição de perfil.</p>
    </div>
  )
}
```

#### `src/app/(app)/configuracoes/page.tsx`

- [ ] Create file:

```typescript
export default function ConfiguracoesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
      <p className="text-muted-foreground">Em breve: configurações da conta.</p>
    </div>
  )
}
```

### Step 19 — Update root redirect

- [ ] Edit `src/app/page.tsx` to redirect to `/dashboard` instead of `/pacientes`:

```typescript
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/dashboard')
}
```

### Step 20 — Commit Phase 3

```bash
cd "d:\REPOS-GITHUB-PARTICULAR\project-anamnese-ia-claude-code-repo-local" && git add src/app/ && git commit -m "feat: add (app) route group with AppLayout, Dashboard page, and migrated routes"
```

---

## Phase 4 — Verification

### Step 21 — Run all tests

```bash
cd "d:\REPOS-GITHUB-PARTICULAR\project-anamnese-ia-claude-code-repo-local" && npx vitest run 2>&1 | tail -20
```

Expected: all test files pass, including:
- `src/lib/credits.test.ts` — 6 tests
- `src/context/AppContext.test.tsx` — 3 tests
- `src/components/dashboard/WeeklyChart.test.tsx` — 4 tests

### Step 22 — Dev server smoke test

```bash
cd "d:\REPOS-GITHUB-PARTICULAR\project-anamnese-ia-claude-code-repo-local" && npx next build 2>&1 | tail -30
```

Expected: build succeeds with no errors. Warnings about `dynamic` rendering are acceptable.

### Step 23 — Final commit

```bash
cd "d:\REPOS-GITHUB-PARTICULAR\project-anamnese-ia-claude-code-repo-local" && git add -A && git status
```

If there are uncommitted files:
```bash
cd "d:\REPOS-GITHUB-PARTICULAR\project-anamnese-ia-claude-code-repo-local" && git add -A && git commit -m "chore: finalize dashboard layout implementation"
```

---

## File checklist

The complete set of new/modified files after this plan is implemented:

| Path | Action |
|------|--------|
| `src/types/index.ts` | MODIFY — add `User` interface |
| `src/lib/mock/user.ts` | CREATE |
| `src/lib/credits.ts` | CREATE |
| `src/lib/credits.test.ts` | CREATE |
| `src/context/AppContext.tsx` | CREATE |
| `src/context/AppContext.test.tsx` | CREATE |
| `src/components/layout/Sidebar.tsx` | CREATE |
| `src/components/layout/Topbar.tsx` | CREATE |
| `src/components/layout/MobileSidebar.tsx` | CREATE |
| `src/components/dashboard/GreetingSection.tsx` | CREATE |
| `src/components/dashboard/MetricsRow.tsx` | CREATE |
| `src/components/dashboard/CreditWidget.tsx` | CREATE |
| `src/components/dashboard/WeeklyChart.tsx` | CREATE |
| `src/components/dashboard/WeeklyChart.test.tsx` | CREATE |
| `src/components/dashboard/RecentActivity.tsx` | CREATE |
| `src/components/ui/sheet.tsx` | INSTALL via shadcn |
| `src/components/ui/dropdown-menu.tsx` | INSTALL via shadcn |
| `src/components/ui/avatar.tsx` | INSTALL via shadcn |
| `src/app/page.tsx` | MODIFY — redirect to `/dashboard` |
| `src/app/(app)/layout.tsx` | CREATE |
| `src/app/(app)/dashboard/page.tsx` | CREATE |
| `src/app/(app)/atendimento/page.tsx` | MOVE from `pacientes/page.tsx` |
| `src/app/(app)/atendimento/novo/page.tsx` | MOVE from `pacientes/novo/page.tsx` |
| `src/app/(app)/atendimento/[id]/page.tsx` | MOVE from `atendimento/[id]/page.tsx` + credit debit |
| `src/app/(app)/resultado/[id]/page.tsx` | MOVE from `resultado/[id]/page.tsx` |
| `src/app/(app)/historico/page.tsx` | CREATE (placeholder) |
| `src/app/(app)/planos/page.tsx` | CREATE (placeholder) |
| `src/app/(app)/perfil/page.tsx` | CREATE (placeholder) |
| `src/app/(app)/configuracoes/page.tsx` | CREATE (placeholder) |
| `src/app/pacientes/` | DELETE |
| `src/app/atendimento/` | DELETE (old location) |
| `src/app/resultado/` | DELETE (old location) |

---

## Key technical decisions (reference)

| Decision | Reason |
|----------|--------|
| `(app)/layout.tsx` is `'use client'` | Sheet (mobile drawer) requires `useState` for open/close |
| Credits default to `50` in `useState` | Avoids hydration mismatch; real value loaded in `useEffect` |
| `useCallback` for `debitCredit` and `refreshCredits` in context | Inline arrow functions in context objects cause infinite loops when consumed in `useEffect` dependency arrays |
| `creditRepository.debitCredit()` after `router.push` | `router.push` is non-blocking; calling debit after push is safe and avoids delaying navigation |
| CSS flex bars for `WeeklyChart` | No external charting lib needed; keeps bundle size small |
| `AvatarFallback` with initials only | Mock auth — no real avatar image available |
| Route group `(app)` | Does not add a URL segment; `/dashboard` is the URL, not `/(app)/dashboard` |
