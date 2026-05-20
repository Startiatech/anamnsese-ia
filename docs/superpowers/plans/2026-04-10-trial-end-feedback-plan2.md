# Trial End Feedback — Plano 2: Admin Feedbacks + Tempo Poupado

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar a página `/console/feedbacks` com métricas, depoimentos e análise de sentimento via Groq; e o card "Tempo Poupado" no dashboard do profissional.

**Architecture:** FeedbackRepository (queries admin) → página admin server component + client component → API route de análise Groq → card TimeSaved no dashboard (query por período sem coluna nova).

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase, Groq `llama-3.3-70b`, Vitest + RTL, shadcn/ui.

**Dependência:** Plano 1 deve estar completo (tabela `feedbacks` criada, `FeedbackRepository` base existente).

**Spec:** `docs/superpowers/specs/2026-04-10-trial-end-feedback-design.md`

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/server/repositories/feedbacks.ts` | Modificar | Adicionar queries admin: listAll, getMetrics, updateSentiment |
| `src/server/repositories/feedbacks-admin.test.ts` | Criar | Testes das queries admin |
| `src/server/repositories/db.ts` | Modificar | Adicionar countByPeriod em ConsultationRepository |
| `src/server/repositories/db.test.ts` | Modificar | Testes de countByPeriod |
| `src/app/(admin)/console/feedbacks/page.tsx` | Criar | Server Component: busca métricas + feedbacks |
| `src/app/(admin)/console/feedbacks/feedbacks-client.tsx` | Criar | Client Component: UI da página |
| `src/app/api/admin/feedbacks/analyze/route.ts` | Criar | API route: análise de sentimento Groq |
| `src/app/api/admin/feedbacks/analyze/route.test.ts` | Criar | Testes da API route |
| `src/components/dashboard/time-saved-card.tsx` | Criar | Card de Tempo Poupado com tabs dia/semana/mês |
| `src/components/dashboard/time-saved-card.test.tsx` | Criar | Testes RTL do card |
| `src/app/(app)/dashboard/page.tsx` | Modificar | Passar dados de contagem por período |
| `src/app/(admin)/console/admin-layout-client.tsx` | Modificar | Adicionar item "Feedbacks" na navegação admin |

---

## Task 1: Queries admin no FeedbackRepository

**Files:**
- Modify: `src/server/repositories/feedbacks.ts`
- Create: `src/server/repositories/feedbacks-admin.test.ts`

- [ ] **Step 1: Escrever testes falhando**

```typescript
// src/server/repositories/feedbacks-admin.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}))

vi.mock('@/server/supabase', () => ({
  supabase: { from: mockFrom },
}))

import { FeedbackRepository } from './feedbacks'

function makeSelectChain(data: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({ data, error: null }),
    then: undefined,
  }
}

describe('FeedbackRepository — admin queries', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('listAll', () => {
    it('retorna lista paginada de feedbacks', async () => {
      const rows = [
        {
          id: 'fb-1', user_id: 'u1', rating: 5,
          message: 'Excelente', plan_id: 'experimental',
          action_taken: 'upgrade_modal', sentiment_score: null,
          sentiment_label: null, analyzed_at: null,
          created_at: '2026-04-10T00:00:00Z',
          users: { name: 'Dr. Ana', email: 'ana@clinic.com', phone: '11999999999' },
        },
      ]
      const chain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: rows, error: null }),
      }
      mockFrom.mockReturnValue(chain)

      const result = await FeedbackRepository.listAll({ page: 0, pageSize: 20 })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('fb-1')
      expect(result[0].userName).toBe('Dr. Ana')
    })
  })

  describe('getMetrics', () => {
    it('calcula metricas corretamente', async () => {
      const rows = [
        { rating: 5, action_taken: 'upgrade_modal' },
        { rating: 3, action_taken: 'declined' },
        { rating: 4, action_taken: 'upgrade_organic' },
      ]
      const chain = {
        select: vi.fn().mockResolvedValue({ data: rows, error: null }),
      }
      mockFrom.mockReturnValue(chain)

      const metrics = await FeedbackRepository.getMetrics()
      expect(metrics.avgRating).toBeCloseTo(4)
      expect(metrics.totalUpgrades).toBe(2)
      expect(metrics.totalChurn).toBe(1)
      expect(metrics.conversionRate).toBeCloseTo(66.67, 1)
    })
  })

  describe('updateSentiment', () => {
    it('atualiza sentiment_score, label e analyzed_at', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })
      mockFrom.mockReturnValue({ update: mockUpdate })

      await FeedbackRepository.updateSentiment('fb-1', 4.2, 'positive')

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          sentiment_score: 4.2,
          sentiment_label: 'positive',
          analyzed_at: expect.any(String),
        })
      )
    })
  })
})
```

- [ ] **Step 2: Rodar e confirmar falha**

```bash
npm test -- src/server/repositories/feedbacks-admin.test.ts
```
Expected: FAIL — `listAll is not a function`

- [ ] **Step 3: Adicionar métodos admin ao FeedbackRepository em `feedbacks.ts`**

Adicione a interface `FeedbackWithUser` e os três métodos ao objeto `FeedbackRepository` existente:

```typescript
export interface FeedbackWithUser {
  id: string
  userId: string
  userName: string
  userEmail: string
  userPhone?: string | null
  rating: number
  message?: string | null
  planId: string
  actionTaken: FeedbackActionTaken
  sentimentScore?: number | null
  sentimentLabel?: string | null
  analyzedAt?: string | null
  createdAt: string
}

export interface FeedbackMetrics {
  avgRating: number
  totalUpgrades: number
  totalChurn: number
  conversionRate: number
}

// Adicione dentro do objeto FeedbackRepository:

  async listAll({ page, pageSize }: { page: number; pageSize: number }): Promise<FeedbackWithUser[]> {
    const from = page * pageSize
    const to = from + pageSize - 1
    const { data } = await supabase
      .from('feedbacks')
      .select('*, users(name, email, phone)')
      .order('created_at', { ascending: false })
      .range(from, to)
    return ((data ?? []) as Array<Record<string, unknown>>).map(row => ({
      id: row.id as string,
      userId: row.user_id as string,
      userName: ((row.users as Record<string, unknown>)?.name as string) ?? '',
      userEmail: ((row.users as Record<string, unknown>)?.email as string) ?? '',
      userPhone: ((row.users as Record<string, unknown>)?.phone as string | null) ?? null,
      rating: row.rating as number,
      message: row.message as string | null,
      planId: row.plan_id as string,
      actionTaken: row.action_taken as FeedbackActionTaken,
      sentimentScore: row.sentiment_score as number | null,
      sentimentLabel: row.sentiment_label as string | null,
      analyzedAt: row.analyzed_at as string | null,
      createdAt: row.created_at as string,
    }))
  },

  async getMetrics(): Promise<FeedbackMetrics> {
    const { data } = await supabase
      .from('feedbacks')
      .select('rating, action_taken')
    const rows = (data ?? []) as Array<{ rating: number; action_taken: string }>
    const total = rows.length
    if (total === 0) return { avgRating: 0, totalUpgrades: 0, totalChurn: 0, conversionRate: 0 }
    const avgRating = rows.reduce((acc, r) => acc + r.rating, 0) / total
    const totalUpgrades = rows.filter(r => r.action_taken === 'upgrade_modal' || r.action_taken === 'upgrade_organic').length
    const totalChurn = rows.filter(r => r.action_taken === 'declined').length
    const conversionRate = (totalUpgrades / total) * 100
    return { avgRating, totalUpgrades, totalChurn, conversionRate }
  },

  async updateSentiment(id: string, score: number, label: string): Promise<void> {
    await supabase
      .from('feedbacks')
      .update({
        sentiment_score: score,
        sentiment_label: label,
        analyzed_at: new Date().toISOString(),
      })
      .eq('id', id)
  },

  async listUnanalyzed(): Promise<Array<{ id: string; rating: number; message: string | null }>> {
    const { data } = await supabase
      .from('feedbacks')
      .select('id, rating, message')
      .is('analyzed_at', null)
    return (data ?? []) as Array<{ id: string; rating: number; message: string | null }>
  },

  async listAll_forReanalysis(): Promise<Array<{ id: string; rating: number; message: string | null }>> {
    const { data } = await supabase
      .from('feedbacks')
      .select('id, rating, message')
    return (data ?? []) as Array<{ id: string; rating: number; message: string | null }>
  },
```

- [ ] **Step 4: Rodar e confirmar verde**

```bash
npm test -- src/server/repositories/feedbacks-admin.test.ts
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/server/repositories/feedbacks.ts src/server/repositories/feedbacks-admin.test.ts
git commit -m "feat(feedbacks): add admin queries (listAll, getMetrics, updateSentiment)"
```

---

## Task 2: countByPeriod no ConsultationRepository

**Files:**
- Modify: `src/server/repositories/db.ts`
- Modify ou criar: `src/server/repositories/db.test.ts`

- [ ] **Step 1: Escrever testes falhando**

```typescript
// Se db.test.ts já existe, adicione este bloco. Se não, crie o arquivo.
// src/server/repositories/db-count.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}))

vi.mock('@/server/supabase', () => ({
  supabase: { from: mockFrom },
}))

import { ConsultationRepository } from './db'

describe('ConsultationRepository.countByPeriod', () => {
  beforeEach(() => vi.clearAllMocks())

  it('conta consultas do dia atual', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      not: vi.fn().mockResolvedValue({ data: [{}, {}], error: null }),
    }
    mockFrom.mockReturnValue(chain)

    const count = await ConsultationRepository.countByPeriod('u1', 'today')
    expect(count).toBe(2)
  })

  it('conta consultas da semana', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      not: vi.fn().mockResolvedValue({ data: [{}], error: null }),
    }
    mockFrom.mockReturnValue(chain)

    const count = await ConsultationRepository.countByPeriod('u1', 'week')
    expect(count).toBe(1)
  })

  it('conta consultas do mes', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      not: vi.fn().mockResolvedValue({ data: [{}, {}, {}], error: null }),
    }
    mockFrom.mockReturnValue(chain)

    const count = await ConsultationRepository.countByPeriod('u1', 'month')
    expect(count).toBe(3)
  })
})
```

- [ ] **Step 2: Rodar e confirmar falha**

```bash
npm test -- src/server/repositories/db-count.test.ts
```
Expected: FAIL — `countByPeriod is not a function`

- [ ] **Step 3: Adicionar `countByPeriod` ao `ConsultationRepository` em `db.ts`**

Dentro do objeto `ConsultationRepository`, adicione:

```typescript
  async countByPeriod(userId: string, period: 'today' | 'week' | 'month'): Promise<number> {
    const now = new Date()
    let since: Date

    if (period === 'today') {
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    } else if (period === 'week') {
      since = new Date(now)
      since.setDate(since.getDate() - 7)
    } else {
      since = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    const { data } = await supabase
      .from('consultations')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', since.toISOString())
      .not('structured_anamnesis', 'is', null)

    return (data ?? []).length
  },
```

- [ ] **Step 4: Rodar e confirmar verde**

```bash
npm test -- src/server/repositories/db-count.test.ts
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/server/repositories/db.ts src/server/repositories/db-count.test.ts
git commit -m "feat(db): add ConsultationRepository.countByPeriod for time-saved metric"
```

---

## Task 3: TimeSavedCard component

**Files:**
- Create: `src/components/dashboard/time-saved-card.tsx`
- Create: `src/components/dashboard/time-saved-card.test.tsx`

- [ ] **Step 1: Escrever testes falhando**

```typescript
// src/components/dashboard/time-saved-card.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TimeSavedCard } from './time-saved-card'

describe('TimeSavedCard', () => {
  it('renderiza tempo em minutos quando menor que 60', () => {
    render(<TimeSavedCard todayCount={0} weekCount={1} monthCount={1} />)
    fireEvent.click(screen.getByRole('tab', { name: /semana/i }))
    expect(screen.getByText(/45min/i)).toBeInTheDocument()
  })

  it('renderiza tempo em horas e minutos quando 60+', () => {
    render(<TimeSavedCard todayCount={0} weekCount={0} monthCount={4} />)
    fireEvent.click(screen.getByRole('tab', { name: /mês/i }))
    expect(screen.getByText(/3h 0min/i)).toBeInTheDocument()
  })

  it('mostra 0min quando nao ha consultas no dia', () => {
    render(<TimeSavedCard todayCount={0} weekCount={0} monthCount={0} />)
    expect(screen.getByText(/0min/i)).toBeInTheDocument()
  })

  it('exibe contagem de consultas', () => {
    render(<TimeSavedCard todayCount={2} weekCount={5} monthCount={10} />)
    expect(screen.getByText(/2 consulta/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e confirmar falha**

```bash
npm test -- src/components/dashboard/time-saved-card.test.tsx
```
Expected: FAIL — `Cannot find module './time-saved-card'`

- [ ] **Step 3: Implementar TimeSavedCard**

```typescript
// src/components/dashboard/time-saved-card.tsx
'use client'

import { useState } from 'react'
import { Clock } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

const MINUTES_PER_CONSULTATION = 45

type Period = 'today' | 'week' | 'month'

interface TimeSavedCardProps {
  todayCount: number
  weekCount: number
  monthCount: number
}

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes}min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${m}min`
}

export function TimeSavedCard({ todayCount, weekCount, monthCount }: TimeSavedCardProps) {
  const [period, setPeriod] = useState<Period>('today')

  const countMap: Record<Period, number> = {
    today: todayCount,
    week: weekCount,
    month: monthCount,
  }

  const count = countMap[period]
  const minutes = count * MINUTES_PER_CONSULTATION

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-violet-500/10 flex items-center justify-center">
              <Clock className="w-4 h-4 text-violet-500" />
            </div>
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Tempo Poupado
            </span>
          </div>
          <Tabs value={period} onValueChange={v => setPeriod(v as Period)}>
            <TabsList className="h-7">
              <TabsTrigger value="today" className="text-xs px-2 py-1">Hoje</TabsTrigger>
              <TabsTrigger value="week" className="text-xs px-2 py-1">Semana</TabsTrigger>
              <TabsTrigger value="month" className="text-xs px-2 py-1">Mês</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <p
          className="text-3xl font-bold"
          style={{ background: 'linear-gradient(90deg, #8B5CF6, #06B6D4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
        >
          {formatTime(minutes)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {count} consulta{count !== 1 ? 's' : ''} × {MINUTES_PER_CONSULTATION}min
        </p>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Rodar e confirmar verde**

```bash
npm test -- src/components/dashboard/time-saved-card.test.tsx
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/time-saved-card.tsx src/components/dashboard/time-saved-card.test.tsx
git commit -m "feat(dashboard): add TimeSavedCard with today/week/month tabs"
```

---

## Task 4: Wiring do TimeSavedCard no dashboard

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Adicionar queries de contagem por período**

Em `src/app/(app)/dashboard/page.tsx`, adicione ao import:

```typescript
import { ConsultationRepository } from '@/server/repositories/db'
import { TimeSavedCard } from '@/components/dashboard/time-saved-card'
```

Na função do Server Component, junto às queries paralelas existentes, adicione:

```typescript
  const [todayCount, weekCount, monthCount] = await Promise.all([
    ConsultationRepository.countByPeriod(payload.sub, 'today'),
    ConsultationRepository.countByPeriod(payload.sub, 'week'),
    ConsultationRepository.countByPeriod(payload.sub, 'month'),
  ])
```

- [ ] **Step 2: Renderizar o card no JSX**

Localize onde os outros cards de métricas são renderizados (`MetricsRow` ou similar) e adicione abaixo:

```tsx
<TimeSavedCard todayCount={todayCount} weekCount={weekCount} monthCount={monthCount} />
```

- [ ] **Step 3: Rodar os testes existentes do dashboard**

```bash
npm test -- dashboard
```
Expected: PASS (todos os testes existentes)

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/dashboard/page.tsx
git commit -m "feat(dashboard): add time-saved metric with daily/weekly/monthly breakdown"
```

---

## Task 5: API route de análise de sentimento Groq

**Files:**
- Create: `src/app/api/admin/feedbacks/analyze/route.ts`
- Create: `src/app/api/admin/feedbacks/analyze/route.test.ts`

- [ ] **Step 1: Escrever testes falhando**

```typescript
// src/app/api/admin/feedbacks/analyze/route.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetServerUser, mockListUnanalyzed, mockListAll, mockUpdateSentiment, mockGroq } = vi.hoisted(() => ({
  mockGetServerUser: vi.fn(),
  mockListUnanalyzed: vi.fn(),
  mockListAll: vi.fn(),
  mockUpdateSentiment: vi.fn(),
  mockGroq: vi.fn(),
}))

vi.mock('@/server/services/session', () => ({ getServerUser: mockGetServerUser }))
vi.mock('@/server/repositories/feedbacks', () => ({
  FeedbackRepository: {
    listUnanalyzed: mockListUnanalyzed,
    listAll_forReanalysis: mockListAll,
    updateSentiment: mockUpdateSentiment,
  },
}))
vi.mock('groq-sdk', () => ({
  default: vi.fn(() => ({
    chat: {
      completions: {
        create: mockGroq,
      },
    },
  })),
}))
vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => ({
      json: async () => data,
      status: init?.status ?? 200,
    }),
  },
}))

import { POST } from './route'

function makeRequest(body: unknown) {
  return { json: async () => body } as Request
}

describe('POST /api/admin/feedbacks/analyze', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna 401 quando nao admin', async () => {
    mockGetServerUser.mockResolvedValue({ role: 'user' })
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(403)
  })

  it('processa feedbacks nao analisados e salva sentimento', async () => {
    mockGetServerUser.mockResolvedValue({ role: 'master' })
    mockListUnanalyzed.mockResolvedValue([
      { id: 'fb-1', rating: 5, message: 'Ótimo' },
    ])
    mockGroq.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            feedbacks: [{ id: 'fb-1', score: 4.8, label: 'positive' }],
          }),
        },
      }],
    })
    mockUpdateSentiment.mockResolvedValue(undefined)

    const res = await POST(makeRequest({ reanalyze: false }))
    expect(res.status).toBe(200)
    expect(mockUpdateSentiment).toHaveBeenCalledWith('fb-1', 4.8, 'positive')
  })

  it('retorna ok com analyzed=0 quando nao ha feedbacks pendentes', async () => {
    mockGetServerUser.mockResolvedValue({ role: 'admin' })
    mockListUnanalyzed.mockResolvedValue([])

    const res = await POST(makeRequest({ reanalyze: false }))
    const body = await res.json()
    expect(body.analyzed).toBe(0)
  })
})
```

- [ ] **Step 2: Rodar e confirmar falha**

```bash
npm test -- src/app/api/admin/feedbacks/analyze/route.test.ts
```
Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 3: Implementar a API route**

```typescript
// src/app/api/admin/feedbacks/analyze/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { getServerUser } from '@/server/services/session'
import { FeedbackRepository } from '@/server/repositories/feedbacks'

const GROQ_MODEL = 'llama-3.3-70b-versatile'

export async function POST(req: NextRequest) {
  const user = await getServerUser()
  if (!user || (user.role !== 'admin' && user.role !== 'master')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json() as { reanalyze?: boolean }
  const feedbacks = body.reanalyze
    ? await FeedbackRepository.listAll_forReanalysis()
    : await FeedbackRepository.listUnanalyzed()

  if (feedbacks.length === 0) {
    return NextResponse.json({ ok: true, analyzed: 0, summary: null })
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  const prompt = `Você é um analista de feedback de produto. Analise os feedbacks abaixo de usuários do plano experimental de um SaaS de anamnese médica com IA.

Para CADA feedback, retorne um score de sentimento (0-5) e um label ('positive', 'neutral', 'negative').

Feedbacks:
${feedbacks.map(f => `ID: ${f.id} | Nota: ${f.rating}/5 | Mensagem: "${f.message ?? 'Sem comentário'}"`).join('\n')}

Responda APENAS com JSON válido no formato:
{
  "feedbacks": [
    { "id": "<id>", "score": <0-5>, "label": "<positive|neutral|negative>" }
  ],
  "summary": {
    "avgScore": <0-5>,
    "topPraises": ["<elogio 1>", "<elogio 2>", "<elogio 3>"],
    "topSuggestions": ["<sugestão 1>", "<sugestão 2>", "<sugestão 3>"]
  }
}`

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
  })

  const raw = completion.choices[0]?.message?.content ?? '{}'
  const parsed = JSON.parse(raw) as {
    feedbacks: Array<{ id: string; score: number; label: string }>
    summary?: {
      avgScore: number
      topPraises: string[]
      topSuggestions: string[]
    }
  }

  await Promise.all(
    (parsed.feedbacks ?? []).map(f =>
      FeedbackRepository.updateSentiment(f.id, f.score, f.label)
    )
  )

  return NextResponse.json({
    ok: true,
    analyzed: parsed.feedbacks.length,
    summary: parsed.summary ?? null,
  })
}
```

- [ ] **Step 4: Rodar e confirmar verde**

```bash
npm test -- src/app/api/admin/feedbacks/analyze/route.test.ts
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/feedbacks/
git commit -m "feat(admin): add Groq sentiment analysis endpoint for feedbacks"
```

---

## Task 6: Página admin `/console/feedbacks`

**Files:**
- Create: `src/app/(admin)/console/feedbacks/page.tsx`
- Create: `src/app/(admin)/console/feedbacks/feedbacks-client.tsx`

- [ ] **Step 1: Implementar Server Component `page.tsx`**

```typescript
// src/app/(admin)/console/feedbacks/page.tsx
import { redirect } from 'next/navigation'
import { getServerUser } from '@/server/services/session'
import { FeedbackRepository } from '@/server/repositories/feedbacks'
import { ROUTES } from '@/lib/routes'
import { FeedbacksClient } from './feedbacks-client'

export default async function FeedbacksPage() {
  const user = await getServerUser()
  if (!user || (user.role !== 'admin' && user.role !== 'master')) {
    redirect(ROUTES.login)
  }

  const [metrics, feedbacks] = await Promise.all([
    FeedbackRepository.getMetrics(),
    FeedbackRepository.listAll({ page: 0, pageSize: 20 }),
  ])

  return (
    <FeedbacksClient
      metrics={metrics}
      feedbacks={feedbacks}
    />
  )
}
```

- [ ] **Step 2: Implementar Client Component `feedbacks-client.tsx`**

```typescript
// src/app/(admin)/console/feedbacks/feedbacks-client.tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Star, Mail, MessageCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { API } from '@/lib/routes'
import type { FeedbackWithUser, FeedbackMetrics } from '@/server/repositories/feedbacks'

interface FeedbacksClientProps {
  metrics: FeedbackMetrics
  feedbacks: FeedbackWithUser[]
}

const ACTION_BADGE: Record<string, { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' }> = {
  upgrade_modal:   { label: 'UPGRADE', variant: 'default' },
  upgrade_organic: { label: 'UPGRADE', variant: 'default' },
  declined:        { label: 'CANCELADO', variant: 'destructive' },
  pending:         { label: 'PENDENTE', variant: 'secondary' },
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          className="w-4 h-4"
          fill={n <= rating ? '#F59E0B' : 'transparent'}
          stroke={n <= rating ? '#F59E0B' : 'currentColor'}
        />
      ))}
    </div>
  )
}

export function FeedbacksClient({ metrics, feedbacks }: FeedbacksClientProps) {
  const [summary, setSummary] = useState<{
    avgScore: number
    topPraises: string[]
    topSuggestions: string[]
  } | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  async function handleAnalyze(reanalyze: boolean) {
    setAnalyzing(true)
    const promise = fetch(API.adminFeedbacksAnalyze, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reanalyze }),
    }).then(async r => {
      if (!r.ok) throw new Error('Erro ao analisar feedbacks')
      return r.json() as Promise<{ analyzed: number; summary: typeof summary }>
    })

    toast.promise(promise, {
      loading: 'Aguarde...',
      success: r => `${r.analyzed} feedback${r.analyzed !== 1 ? 's' : ''} analisado${r.analyzed !== 1 ? 's' : ''}.`,
      error: 'Erro ao analisar feedbacks.',
    })

    const result = await promise.catch(() => null)
    setAnalyzing(false)
    if (result?.summary) setSummary(result.summary)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Feedback Intelligence</h1>
        <p className="text-muted-foreground text-sm">Analise o sentimento dos usuários e otimize a conversão.</p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Satisfação</p>
            <p className="text-3xl font-bold">{metrics.avgRating.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Média Global (1-5)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Conversão</p>
            <p className="text-3xl font-bold">{metrics.conversionRate.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">Upgrades de Trial</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Upgrades</p>
            <p className="text-3xl font-bold">{metrics.totalUpgrades}</p>
            <p className="text-xs text-muted-foreground">Usuários Retidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Churn</p>
            <p className="text-3xl font-bold">{metrics.totalChurn}</p>
            <p className="text-xs text-muted-foreground">Contas Descartadas</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Análise Groq */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <p className="text-sm font-semibold">Análise Groq</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {summary ? (
              <div className="text-sm space-y-3">
                <p className="font-medium">Média de sentimento: {summary.avgScore.toFixed(1)}/5</p>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Top 3 Elogios</p>
                  <ol className="list-decimal list-inside space-y-1">
                    {summary.topPraises.map((p, i) => <li key={i} className="text-xs">{p}</li>)}
                  </ol>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Top 3 Sugestões</p>
                  <ol className="list-decimal list-inside space-y-1">
                    {summary.topSuggestions.map((s, i) => <li key={i} className="text-xs">{s}</li>)}
                  </ol>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Clique no botão abaixo para processar os feedbacks com inteligência artificial e extrair métricas de sentimento.
              </p>
            )}
            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                onClick={() => handleAnalyze(false)}
                disabled={analyzing}
              >
                Analisar Feedbacks
              </Button>
              {summary && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAnalyze(true)}
                  disabled={analyzing}
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Recalcular IA
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Depoimentos */}
        <div className="lg:col-span-2 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Depoimentos Recentes
          </p>
          {feedbacks.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                Nenhum feedback registrado ainda.
              </CardContent>
            </Card>
          ) : (
            feedbacks.map(fb => {
              const badge = ACTION_BADGE[fb.actionTaken] ?? ACTION_BADGE.pending
              const whatsappNumber = fb.userPhone?.replace(/\D/g, '')
              return (
                <Card key={fb.id}>
                  <CardContent className="pt-4 pb-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <StarRow rating={fb.rating} />
                        <Badge variant={badge.variant} className="text-xs">{badge.label}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(fb.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" asChild>
                          <a href={`mailto:${fb.userEmail}`}>
                            <Mail className="w-3 h-3 mr-1" />
                            Email
                          </a>
                        </Button>
                        {whatsappNumber && (
                          <Button size="sm" variant="outline" asChild>
                            <a
                              href={`https://wa.me/55${whatsappNumber}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <MessageCircle className="w-3 h-3 mr-1" />
                              Whats
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                    {fb.message && (
                      <p className="text-sm italic">"{fb.message}"</p>
                    )}
                    <Separator />
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>👤 {fb.userName}</span>
                      <span>✉ {fb.userEmail}</span>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(admin\)/console/feedbacks/
git commit -m "feat(admin): add feedbacks page with metrics, testimonials and Groq sentiment analysis"
```

---

## Task 7: Adicionar Feedbacks na navegação admin

**Files:**
- Modify: `src/app/(admin)/console/admin-layout-client.tsx`

- [ ] **Step 1: Abrir o arquivo e localizar o array de navegação**

Localize o array de `NAV_ITEMS` ou similar em `admin-layout-client.tsx`.

- [ ] **Step 2: Adicionar item Feedbacks**

```typescript
import { ROUTES } from '@/lib/routes'
import { MessageSquare } from 'lucide-react' // adicione ao import de lucide-react existente

// No array de nav items, adicione:
{ href: ROUTES.consoleFeedbacks, label: 'Feedbacks', icon: MessageSquare },
```

- [ ] **Step 3: Rodar todos os testes**

```bash
npm test
```
Expected: PASS (todos os testes do projeto)

- [ ] **Step 4: Commit final**

```bash
git add src/app/\(admin\)/console/admin-layout-client.tsx
git commit -m "feat(admin-nav): add Feedbacks link to admin sidebar"
```

---

## Checkpoint — Plano 2 completo

Ao finalizar todas as tasks, o sistema deve:

- [ ] Dashboard do profissional exibe card "Tempo Poupado" com tabs Hoje/Semana/Mês
- [ ] Contagem baseada em consultas reais × 45min, sem coluna nova no banco
- [ ] Admin `/console/feedbacks` exibe 4 cards de métricas (satisfação, conversão, upgrades, churn)
- [ ] Lista de depoimentos com badge por status (UPGRADE/CANCELADO/PENDENTE), Email e WhatsApp
- [ ] Botão "Analisar Feedbacks" processa apenas feedbacks sem `analyzed_at`
- [ ] Botão "Recalcular IA" reprocessa todos os feedbacks
- [ ] Análise Groq salva `sentiment_score`, `sentiment_label` e `analyzed_at` por feedback
- [ ] Item "Feedbacks" aparece no sidebar do admin
