# Groq Transcription Chunking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Suportar áudios de qualquer duração na transcrição removendo o limite de 25MB e implementando byte-splitting server-side em chunks de 20MB.

**Architecture:** Uma função pura `transcribeInChunks(file, groq)` em `src/lib/transcribe-chunks.ts` divide o `ArrayBuffer` do arquivo em fatias de 20MB, transcreve cada uma sequencialmente via Groq Whisper e concatena os resultados. A rota `POST /api/transcribe` delega para essa função e remove a validação de tamanho máximo.

**Tech Stack:** `groq-sdk@1.1.2`, Next.js 16 App Router (Node.js runtime), Vitest (`@vitest-environment node`), `vi.hoisted`

---

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/lib/transcribe-chunks.ts` | Criar — função `transcribeInChunks` e `splitBuffer` |
| `src/lib/transcribe-chunks.test.ts` | Criar — testes unitários |
| `src/app/api/transcribe/route.ts` | Modificar — delegar para `transcribeInChunks`, remover limite de tamanho |
| `src/app/api/transcribe/route.test.ts` | Modificar — mockar `@/lib/transcribe-chunks`, remover teste de 25MB |

---

## Task 1: Criar `src/lib/transcribe-chunks.ts` com testes (TDD)

**Files:**
- Create: `src/lib/transcribe-chunks.ts`
- Create: `src/lib/transcribe-chunks.test.ts`

### Step 1: Criar o arquivo de testes

- [ ] Criar `src/lib/transcribe-chunks.test.ts` com o seguinte conteúdo:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Groq from 'groq-sdk'

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}))

vi.mock('groq-sdk', () => ({
  default: class MockGroq {
    audio = { transcriptions: { create: mockCreate } }
  },
}))

import { transcribeInChunks, CHUNK_SIZE_BYTES } from './transcribe-chunks'

function makeFile(sizeMB: number): File {
  const bytes = new Uint8Array(sizeMB * 1024 * 1024)
  return new File([bytes], 'audio.mp3', { type: 'audio/mpeg' })
}

function makeGroq(): Groq {
  const { default: MockGroq } = vi.importMock('groq-sdk') as { default: new () => Groq }
  return new MockGroq()
}

describe('transcribeInChunks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreate.mockResolvedValue('texto transcrito')
  })

  it('calls Groq once for a file smaller than CHUNK_SIZE_BYTES', async () => {
    const file = makeFile(5)
    const groq = makeGroq()
    const result = await transcribeInChunks(file, groq)
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(result).toBe('texto transcrito')
  })

  it('calls Groq once per chunk for large files and joins with space', async () => {
    mockCreate
      .mockResolvedValueOnce('primeira parte')
      .mockResolvedValueOnce('segunda parte')
      .mockResolvedValueOnce('terceira parte')

    // 45MB -> 3 chunks (20 + 20 + 5)
    const file = makeFile(45)
    const groq = makeGroq()
    const result = await transcribeInChunks(file, groq)

    expect(mockCreate).toHaveBeenCalledTimes(3)
    expect(result).toBe('primeira parte segunda parte terceira parte')
  })

  it('passes correct file name and type to each chunk', async () => {
    const file = makeFile(5)
    const groq = makeGroq()
    await transcribeInChunks(file, groq)

    const calledFile = mockCreate.mock.calls[0][0].file as File
    expect(calledFile.name).toBe('audio.mp3')
    expect(calledFile.type).toBe('audio/mpeg')
  })

  it('propagates error if any chunk fails', async () => {
    mockCreate
      .mockResolvedValueOnce('primeira parte')
      .mockRejectedValueOnce(new Error('Groq timeout'))

    const file = makeFile(45)
    const groq = makeGroq()
    await expect(transcribeInChunks(file, groq)).rejects.toThrow('Groq timeout')
  })
})

describe('CHUNK_SIZE_BYTES', () => {
  it('is exactly 20MB', () => {
    expect(CHUNK_SIZE_BYTES).toBe(20 * 1024 * 1024)
  })
})
```

### Step 2: Rodar os testes — confirmar FALHAM (RED)

- [ ] Executar:

```bash
cd "d:\REPOS-GITHUB-PARTICULAR\project-anamnese-ia-claude-code-repo-local" && npm test -- src/lib/transcribe-chunks.test.ts 2>&1 | tail -15
```

Saída esperada: falha com `Cannot find module './transcribe-chunks'`.

### Step 3: Criar a implementação

- [ ] Criar `src/lib/transcribe-chunks.ts` com o seguinte conteúdo:

```ts
import type Groq from 'groq-sdk'

export const CHUNK_SIZE_BYTES = 20 * 1024 * 1024 // 20MB

export async function transcribeInChunks(file: File, groq: Groq): Promise<string> {
  const buffer = await file.arrayBuffer()
  const chunks = splitBuffer(buffer, CHUNK_SIZE_BYTES)

  const transcripts: string[] = []
  for (const chunk of chunks) {
    const chunkFile = new File([chunk], file.name, { type: file.type })
    // Groq SDK does not narrow return type for response_format: 'text'; cast is intentional
    const text = await groq.audio.transcriptions.create({
      file: chunkFile,
      model: 'whisper-large-v3',
      language: 'pt',
      response_format: 'text',
    }) as unknown as string
    transcripts.push(text)
  }

  return transcripts.join(' ')
}

function splitBuffer(buffer: ArrayBuffer, chunkSize: number): ArrayBuffer[] {
  const chunks: ArrayBuffer[] = []
  let offset = 0
  while (offset < buffer.byteLength) {
    chunks.push(buffer.slice(offset, offset + chunkSize))
    offset += chunkSize
  }
  return chunks
}
```

### Step 4: Rodar os testes — confirmar PASSAM (GREEN)

- [ ] Executar:

```bash
cd "d:\REPOS-GITHUB-PARTICULAR\project-anamnese-ia-claude-code-repo-local" && npm test -- src/lib/transcribe-chunks.test.ts 2>&1 | tail -15
```

Saída esperada: `5 passed`.

### Step 5: Commit

- [ ] Executar:

```bash
cd "d:\REPOS-GITHUB-PARTICULAR\project-anamnese-ia-claude-code-repo-local"
git add src/lib/transcribe-chunks.ts src/lib/transcribe-chunks.test.ts
git commit -m "feat: add transcribeInChunks for large audio files"
```

---

## Task 2: Atualizar `POST /api/transcribe` para usar chunking

**Files:**
- Modify: `src/app/api/transcribe/route.ts`
- Modify: `src/app/api/transcribe/route.test.ts`

### Step 1: Atualizar o arquivo de testes da rota

- [ ] Substituir o conteúdo completo de `src/app/api/transcribe/route.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetServerUser, mockTranscribeInChunks } = vi.hoisted(() => ({
  mockGetServerUser: vi.fn(),
  mockTranscribeInChunks: vi.fn(),
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

vi.mock('@/lib/transcribe-chunks', () => ({ transcribeInChunks: mockTranscribeInChunks }))

vi.mock('groq-sdk', () => ({
  default: class Groq {},
}))

import { POST } from './route'

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
    mockTranscribeInChunks.mockResolvedValue('Paciente relata dor de cabeça.')
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

  it('returns transcript on success', async () => {
    const file = makeFile('audio.mp3', 2)
    const res = await POST(makeFormData(file) as never)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.transcript).toBe('Paciente relata dor de cabeça.')
  })

  it('accepts files larger than 25MB', async () => {
    const bigFile = makeFile('audio.mp3', 60)
    mockTranscribeInChunks.mockResolvedValue('consulta longa transcrita')
    const res = await POST(makeFormData(bigFile) as never)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.transcript).toBe('consulta longa transcrita')
  })

  it('returns 502 when transcription fails', async () => {
    mockTranscribeInChunks.mockRejectedValue(new Error('Groq API unavailable'))
    const file = makeFile('audio.mp3', 2)
    const res = await POST(makeFormData(file) as never)
    expect(res.status).toBe(502)
    const json = await res.json()
    expect(json.error).toBe('Groq API unavailable')
  })
})
```

### Step 2: Rodar os testes — confirmar FALHAM (RED)

- [ ] Executar:

```bash
cd "d:\REPOS-GITHUB-PARTICULAR\project-anamnese-ia-claude-code-repo-local" && npm test -- src/app/api/transcribe/route.test.ts 2>&1 | tail -15
```

Saída esperada: falhas porque a rota ainda usa Groq diretamente e tem o limite de 25MB.

### Step 3: Atualizar a rota

- [ ] Substituir o conteúdo completo de `src/app/api/transcribe/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { getServerUser } from '@/server/services/session'
import { transcribeInChunks } from '@/lib/transcribe-chunks'

if (!process.env.GROQ_API_KEY) {
  throw new Error('GROQ_API_KEY environment variable is not set.')
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('audio') as File | null

  if (!file) {
    return NextResponse.json({ error: 'Arquivo de áudio não enviado.' }, { status: 400 })
  }

  try {
    const transcript = await transcribeInChunks(file, groq)
    return NextResponse.json({ transcript })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro na transcrição.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
```

### Step 4: Rodar testes da rota — confirmar PASSAM (GREEN)

- [ ] Executar:

```bash
cd "d:\REPOS-GITHUB-PARTICULAR\project-anamnese-ia-claude-code-repo-local" && npm test -- src/app/api/transcribe/route.test.ts 2>&1 | tail -15
```

Saída esperada: `5 passed`.

### Step 5: Rodar suite completa — confirmar sem regressões

- [ ] Executar:

```bash
cd "d:\REPOS-GITHUB-PARTICULAR\project-anamnese-ia-claude-code-repo-local" && npm test 2>&1 | tail -20
```

Saída esperada: todos os testes anteriores continuam passando (os 7 failures pré-existentes em `edit-patient-sheet.test.tsx` são normais e não relacionados).

### Step 6: Commit

- [ ] Executar:

```bash
cd "d:\REPOS-GITHUB-PARTICULAR\project-anamnese-ia-claude-code-repo-local"
git add src/app/api/transcribe/route.ts src/app/api/transcribe/route.test.ts
git commit -m "feat: delegate transcription to transcribeInChunks, remove 25MB limit"
```
