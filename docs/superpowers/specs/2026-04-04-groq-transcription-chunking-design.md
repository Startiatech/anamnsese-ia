# Design: Chunking de Áudio para Transcrição Longa

**Data:** 2026-04-04
**Escopo:** Remover o limite de 25MB da rota `/api/transcribe` e suportar áudios de qualquer duração via byte-splitting server-side

---

## Contexto

A rota `POST /api/transcribe` atualmente rejeita arquivos > 25MB (limite da API Groq Whisper). Consultas médicas têm entre 10 e 60+ minutos, o que gera arquivos de 10MB a 60MB+ em MP3 128kbps. A solução é dividir o arquivo em chunks de 20MB no servidor, transcrever cada um sequencialmente e concatenar os textos.

---

## Abordagem

**Byte-splitting:** leitura do `ArrayBuffer` do arquivo e divisão em fatias de `CHUNK_SIZE_BYTES = 20 * 1024 * 1024` (20MB). Sem overlap — o Whisper é robusto o suficiente para transcrição em PT-BR sem necessidade de sobreposição. Cada fatia é enviada ao Groq Whisper como um `File` com o mesmo `type` do original. Os textos retornados são concatenados com `' '` (espaço simples).

**Por que funciona:** O Whisper descarta frames corrompidos no início/fim de cada chunk e continua a transcrição sem impacto semântico visível. Validado como prática padrão para chunking de áudio longo com Whisper.

---

## Mudanças

### 1. `src/lib/transcribe-chunks.ts` — novo arquivo

Função pura e testável isoladamente:

```ts
import Groq from 'groq-sdk'

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

**Interface:**
- Input: `file: File`, `groq: Groq`
- Output: `Promise<string>` — transcript completo concatenado
- Lança exceção se qualquer chunk falhar (propagado para a rota)

### 2. `src/app/api/transcribe/route.ts` — modificar

- Remover `MAX_SIZE_MB` e a validação de tamanho (sem limite client-side)
- Substituir a chamada direta ao Groq por `transcribeInChunks(file, groq)`

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

### 3. `src/lib/transcribe-chunks.test.ts` — novo arquivo

Testes unitários da função `transcribeInChunks` e `splitBuffer` (via `CHUNK_SIZE_BYTES`):

- Arquivo menor que 20MB → 1 chunk, 1 chamada ao Groq, retorna transcript direto
- Arquivo de 45MB → 3 chunks (20 + 20 + 5MB), 3 chamadas, transcritos concatenados com espaço
- Falha no segundo chunk → exceção propagada
- `splitBuffer` com tamanho exato múltiplo → N chunks sem resto
- `splitBuffer` com tamanho não múltiplo → último chunk menor

### 4. `src/app/api/transcribe/route.test.ts` — modificar

- Remover o teste `'returns 400 when file exceeds 25MB'` (validação removida)
- Remover export/import de `MAX_SIZE_MB`
- Mockar `@/lib/transcribe-chunks` em vez de `groq-sdk` diretamente
- Cenários restantes: 401 (sem auth), 400 (sem arquivo), 200 (sucesso), 502 (erro)

---

## O que NÃO muda

- Interface da rota (`POST /api/transcribe`, `FormData { audio }`, `{ transcript }`)
- `StepAudio` — nenhuma mudança no componente
- Sem limite de tamanho exposto ao usuário (a rota aceita qualquer tamanho)
- Sem storage do áudio

---

## Fora do escopo

- Overlap entre chunks (pode ser adicionado se houver queixas de corte de palavras)
- Progresso em tempo real (streaming de chunks via SSE)
- Retry automático por chunk
