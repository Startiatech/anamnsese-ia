# Groq Whisper Transcription Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar `POST /api/transcribe` com Groq Whisper (áudio → texto bruto) e corrigir a logo navegável no layout de atendimento.

**Architecture:** A rota recebe `FormData { audio }`, valida auth via JWT, envia o arquivo ao Groq Whisper via SDK oficial e retorna `{ transcript }`. O áudio nunca é persistido. O layout `(session)` tem a logo dentro de um `<Link>` que deve ser removido para manter o usuário "preso" no fluxo de atendimento.

**Tech Stack:** `groq-sdk`, Next.js App Router (Node.js runtime), Vitest (`@vitest-environment node`), `vi.hoisted` para mocks

---

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/app/api/transcribe/route.ts` | Modificar — implementar integração Groq |
| `src/app/api/transcribe/route.test.ts` | Criar — testes da rota |
| `src/app/(session)/layout.tsx` | Modificar — remover `<Link>` da logo |

---

## Task 1: Instalar `groq-sdk`

- [ ] **Step 1: Instalar o pacote**

```bash
npm install groq-sdk
```

Saída esperada: `added 1 package` (ou similar, sem erros).

- [ ] **Step 2: Verificar instalação**

```bash
cat package.json | grep groq
```

Saída esperada: `"groq-sdk": "^<versão>"`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install groq-sdk"
```

---

## Task 2: Corrigir logo navegável no layout `(session)`

**Arquivo:** `src/app/(session)/layout.tsx`

- [ ] **Step 1: Remover `<Link>` da logo**

Substituir:

```tsx
import { Logo } from '@/components/ui/logo'
import Link from 'next/link'

export default function SessionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border bg-card fixed top-0 left-0 right-0 z-40 flex items-center px-6">
        <Link href="/dashboard">
          <Logo size="sm" id="session" />
        </Link>
      </header>
      <main className="pt-14">
        <div className="container max-w-3xl mx-auto px-4 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
```

Por:

```tsx
import { Logo } from '@/components/ui/logo'

export default function SessionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border bg-card fixed top-0 left-0 right-0 z-40 flex items-center px-6">
        <Logo size="sm" id="session" />
      </header>
      <main className="pt-14">
        <div className="container max-w-3xl mx-auto px-4 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Verificar visualmente no browser**

Navegar para `/consultation/[id]` qualquer — a logo não deve ser clicável nem redirecionar.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(session\)/layout.tsx
git commit -m "fix: remove logo link in session layout to prevent navigation during consultation"
```

---

## Task 3: Testes da rota `POST /api/transcribe`

**Arquivo:** `src/app/api/transcribe/route.test.ts` (criar)

- [ ] **Step 1: Criar arquivo de teste com mocks e casos**

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetServerUser, mockCreate } = vi.hoisted(() => ({
  mockGetServerUser: vi.fn(),
  mockCreate: vi.fn(),
}))

vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => ({
      json: async () => data,
      status: init?.status ?? 200,
    }),
  },
}))

vi.mock('@/server/services/session', () => ({ getServerUser: mockGetServerUser }))

vi.mock('groq-sdk', () => ({
  default: class Groq {
    audio = { transcriptions: { create: mockCreate } }
  },
}))

import { POST } from './route'

const MAX_SIZE_MB = 25

function makeFormData(file: File | null): Request {
  const fd = new FormData()
  if (file) fd.append('audio', file)
  return { formData: async () => fd } as unknown as Request
}

function makeFile(name: string, sizeMB: number): File {
  const bytes = new Uint8Array(sizeMB * 1024 * 1024)
  return new File([bytes], name, { type: 'audio/mpeg' })
}

describe('POST /api/transcribe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetServerUser.mockResolvedValue({ sub: 'user-1' })
    mockCreate.mockResolvedValue({ text: 'Paciente relata dor de cabeça.' })
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetServerUser.mockResolvedValue(null)
    const res = await POST(makeFormData(makeFile('audio.mp3', 1)) as never)
    expect(res.status).toBe(401)
  })

  it('returns 400 when audio file is missing', async () => {
    const res = await POST(makeFormData(null) as never)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Arquivo de áudio não enviado.')
  })

  it('returns 400 when file exceeds 25MB', async () => {
    const bigFile = makeFile('big.mp3', MAX_SIZE_MB + 1)
    const res = await POST(makeFormData(bigFile) as never)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('25MB')
  })

  it('returns transcript on success', async () => {
    const file = makeFile('audio.mp3', 2)
    const res = await POST(makeFormData(file) as never)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.transcript).toBe('Paciente relata dor de cabeça.')
  })

  it('returns 502 when Groq SDK throws', async () => {
    mockCreate.mockRejectedValue(new Error('Groq API unavailable'))
    const file = makeFile('audio.mp3', 2)
    const res = await POST(makeFormData(file) as never)
    expect(res.status).toBe(502)
    const json = await res.json()
    expect(json.error).toBe('Groq API unavailable')
  })
})
```

- [ ] **Step 2: Rodar os testes — confirmar que FALHAM (RED)**

```bash
npm test -- src/app/api/transcribe/route.test.ts
```

Saída esperada: todos os testes falhando com algo como `Cannot find module './route'` ou `501 not implemented`.

---

## Task 4: Implementar `POST /api/transcribe`

**Arquivo:** `src/app/api/transcribe/route.ts` (modificar)

- [ ] **Step 1: Implementar a rota**

```ts
import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { getServerUser } from '@/server/services/session'

const MAX_SIZE_MB = 25

export async function POST(req: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('audio') as File | null

  if (!file) {
    return NextResponse.json({ error: 'Arquivo de áudio não enviado.' }, { status: 400 })
  }

  const sizeMB = file.size / (1024 * 1024)
  if (sizeMB > MAX_SIZE_MB) {
    return NextResponse.json(
      { error: `Arquivo muito grande. Máximo: ${MAX_SIZE_MB}MB.` },
      { status: 400 }
    )
  }

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
    const transcription = await groq.audio.transcriptions.create({
      file,
      model: 'whisper-large-v3',
      language: 'pt',
      response_format: 'text',
    })
    return NextResponse.json({ transcript: transcription })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro na transcrição.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
```

- [ ] **Step 2: Rodar os testes — confirmar que PASSAM (GREEN)**

```bash
npm test -- src/app/api/transcribe/route.test.ts
```

Saída esperada: `5 passed`.

- [ ] **Step 3: Rodar suite completa — confirmar sem regressões**

```bash
npm test
```

Saída esperada: todos os testes anteriores continuam passando.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/transcribe/route.ts src/app/api/transcribe/route.test.ts
git commit -m "feat: implement POST /api/transcribe with Groq Whisper"
```

---

## Task 5: Teste de fumaça manual

- [ ] **Step 1: Iniciar o servidor de desenvolvimento**

```bash
npm run dev
```

- [ ] **Step 2: Navegar até um atendimento em andamento**

Ir para `/consultation/[id]` → avançar até o step 3 (Áudio).

- [ ] **Step 3: Testar o upload**

Selecionar um arquivo de áudio real (MP3 ou WAV curto). Clicar em "Iniciar Processamento". Verificar:
- Toast "Aguarde..." aparece
- Toast "Transcrição concluída!" aparece
- O fluxo avança para o step 4

- [ ] **Step 4: Testar a logo**

No step 3, confirmar que a logo **não é clicável** e não redireciona ao clicar.

- [ ] **Step 5: Adicionar `GROQ_API_KEY` às variáveis da Vercel (para deploy)**

No painel Vercel → Settings → Environment Variables → adicionar `GROQ_API_KEY` com o mesmo valor do `.env.local`.
