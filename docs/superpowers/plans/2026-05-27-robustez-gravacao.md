# Robustez da Gravação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar a alucinação do Whisper em silêncio e tornar a gravação resiliente a hibernação/interrupção, preservando o áudio capturado e avisando o motivo.

**Architecture:** Lógica nova extraída em hooks isolados (`use-silence-detection`, `use-wake-lock`, `use-recording-interruption`) e uma função pura (`hallucination-filter`), orquestrados por `step-audio.tsx`. Servidor (`transcribe-chunks.ts`) recebe endurecimento do Whisper (`temperature: 0` + `prompt`) e aplica o filtro de alucinação. VAD por volume via Web Audio API nativa (sem conta, sem custo, local).

**Tech Stack:** Next.js 16, React 19, TypeScript, Web Audio API (`AnalyserNode`), `navigator.wakeLock`, `MediaRecorder`, Groq SDK (`whisper-large-v3`), Vitest 4 + RTL, Playwright.

**Spec:** `docs/superpowers/specs/2026-05-27-robustez-gravacao-design.md`

---

## File Structure

| Arquivo | Responsabilidade |
| --- | --- |
| `src/lib/hallucination-filter.ts` | Função pura: remove frases de alucinação isoladas. |
| `src/lib/transcribe-chunks.ts` (modificar) | `temperature: 0` + `prompt` + aplicar filtro. |
| `src/hooks/use-silence-detection.ts` | VAD: callbacks `onSilence`/`onSpeech`. |
| `src/hooks/use-wake-lock.ts` | Adquirir/liberar/re-adquirir Wake Lock. |
| `src/hooks/use-recording-interruption.ts` | Detectar interrupção + reportar motivo. |
| `src/components/steps/step-audio.tsx` (modificar) | Multi-segmento + orquestração dos hooks + UI. |
| `e2e/specs/app/consultation.spec.ts` (modificar) | E2E de interrupção. |
| `docs/architecture.md` (modificar) | Fluxo de gravação revisado. |
| `build-docs/2026-05-27/2026-05-27-robustez-gravacao.md` | Build-doc final. |

Convenções de teste: co-localizado `.test.ts(x)`; `// @vitest-environment node` na 1ª linha p/ lógica pura; mocks via `vi.hoisted`; `pnpm test` (unit), `pnpm run test:e2e` (E2E). **Não rode `pnpm run build`.**

---

## Task 1: Filtro de alucinação (função pura)

**Files:**
- Create: `src/lib/hallucination-filter.ts`
- Test: `src/lib/hallucination-filter.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { filterHallucinations } from './hallucination-filter'

describe('filterHallucinations', () => {
  it('removes a known phrase when it is the entire segment', () => {
    expect(filterHallucinations('Tchau')).toBe('')
  })

  it('removes known phrase case-insensitively and trimming spaces', () => {
    expect(filterHallucinations('  OBRIGADO.  ')).toBe('')
  })

  it('preserves "obrigado" inside a real sentence', () => {
    const input = 'O paciente disse obrigado ao final da consulta.'
    expect(filterHallucinations(input)).toBe(input)
  })

  it('removes a hallucinated line but keeps the real lines', () => {
    const input = 'Paciente refere dor torácica.\nLegendas pela comunidade Amara.org\nNega febre.'
    expect(filterHallucinations(input)).toBe('Paciente refere dor torácica.\nNega febre.')
  })

  it('returns empty string for empty input', () => {
    expect(filterHallucinations('')).toBe('')
  })

  it('keeps normal medical text untouched', () => {
    const input = 'Pressão arterial 120 por 80. Ausculta sem alterações.'
    expect(filterHallucinations(input)).toBe(input)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/hallucination-filter.test.ts`
Expected: FAIL — "filterHallucinations is not a function" / module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/hallucination-filter.ts

// Frases que o whisper-large-v3 inventa em silêncio (pt-BR), normalizadas
// (lowercase, sem pontuação final). Só removidas quando isoladas num segmento.
const HALLUCINATION_PHRASES = new Set<string>([
  'tchau',
  'obrigado',
  'obrigada',
  'boa noite',
  'bom dia',
  'boa tarde',
  'ate logo',
  'ate a proxima',
  'obrigado pela atencao',
  'obrigado por assistir',
  'inscreva-se no canal',
  'legendas pela comunidade amara.org',
  'legendas pela comunidade amara org',
])

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .replace(/[.!?…]+$/g, '') // remove pontuação final
    .trim()
}

/**
 * Remove frases de alucinação conhecidas SOMENTE quando ocupam um segmento
 * inteiro (texto completo ou uma linha isolada). Nunca remove a palavra no
 * meio de uma frase real.
 */
export function filterHallucinations(text: string): string {
  if (!text) return ''

  // Caso 1: o texto inteiro é uma alucinação.
  if (HALLUCINATION_PHRASES.has(normalize(text))) return ''

  // Caso 2: linhas isoladas que são alucinação.
  const keptLines = text
    .split('\n')
    .filter(line => !HALLUCINATION_PHRASES.has(normalize(line)))

  return keptLines.join('\n')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/hallucination-filter.test.ts`
Expected: PASS (6 passing).

- [ ] **Step 5: Commit**

```bash
git add src/lib/hallucination-filter.ts src/lib/hallucination-filter.test.ts
git commit -m "feat(transcribe): adiciona filtro de alucinacao do whisper"
```

---

## Task 2: Endurecer Whisper + aplicar filtro

**Files:**
- Modify: `src/lib/transcribe-chunks.ts`
- Test: `src/lib/transcribe-chunks.test.ts` (adicionar casos)

- [ ] **Step 1: Add failing tests for hardening + filtering**

Adicionar dentro do `describe('transcribeInChunks', ...)` em `src/lib/transcribe-chunks.test.ts`:

```typescript
  it('sends temperature 0 and a medical prompt to Groq', async () => {
    const file = makeFile(5)
    const groq = makeGroq()
    await transcribeInChunks(file, groq)

    const args = mockCreate.mock.calls[0][0] as { temperature: number; prompt: string }
    expect(args.temperature).toBe(0)
    expect(args.prompt).toContain('consulta médica')
  })

  it('filters isolated hallucination phrases from the result', async () => {
    mockCreate.mockResolvedValueOnce('Paciente refere cefaleia.\nTchau')
    const file = makeFile(5)
    const groq = makeGroq()
    const result = await transcribeInChunks(file, groq)
    expect(result).toBe('Paciente refere cefaleia.')
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib/transcribe-chunks.test.ts`
Expected: FAIL — `temperature`/`prompt` undefined; resultado ainda contém "Tchau".

- [ ] **Step 3: Implement hardening + filtering**

Em `src/lib/transcribe-chunks.ts`, adicionar o import no topo:

```typescript
import { filterHallucinations } from './hallucination-filter'
```

Adicionar a constante após `CHUNK_SIZE_BYTES`:

```typescript
export const TRANSCRIPTION_PROMPT = 'Transcrição de consulta médica em português do Brasil.'
```

Substituir o bloco de chamada ao Groq dentro do loop:

```typescript
    // Groq SDK does not narrow return type for response_format: 'text'; cast is intentional
    const raw = await groq.audio.transcriptions.create({
      file: chunkFile,
      model: 'whisper-large-v3',
      language: 'pt',
      response_format: 'text',
      temperature: 0,
      prompt: TRANSCRIPTION_PROMPT,
    }) as unknown as string
    const text = filterHallucinations(raw)
    transcripts.push(text)
    onChunk?.(text)
```

> Nota: o `join(' ')` final pode deixar segmentos vazios virarem espaço duplo; isso é cosmético e tolerável. Não tratar agora (YAGNI).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/lib/transcribe-chunks.test.ts`
Expected: PASS (todos, incluindo os 2 novos). Os testes antigos que esperam `'texto transcrito'` continuam passando pois não são frases de alucinação.

- [ ] **Step 5: Commit**

```bash
git add src/lib/transcribe-chunks.ts src/lib/transcribe-chunks.test.ts
git commit -m "feat(transcribe): endurece whisper (temperature 0 + prompt) e aplica filtro"
```

---

## Task 3: Hook de detecção de silêncio (VAD)

**Files:**
- Create: `src/hooks/use-silence-detection.ts`
- Test: `src/hooks/use-silence-detection.test.ts`

O hook recebe a `MediaStream`, um flag `active`, e callbacks. Usa `AudioContext` + `AnalyserNode` para medir volume; quando o volume fica abaixo do limiar por `silenceMs`, chama `onSilence`; ao voltar acima, chama `onSpeech`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/hooks/use-silence-detection.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSilenceDetection } from './use-silence-detection'

// Controla o valor de volume retornado pelo AnalyserNode mockado.
let mockVolume = 0

class FakeAnalyser {
  fftSize = 0
  frequencyBinCount = 32
  getByteTimeDomainData(arr: Uint8Array) {
    // 128 = silêncio absoluto (centro). Desvio = volume.
    const deviation = Math.round(mockVolume * 127)
    arr.fill(128 + deviation)
  }
  connect() {}
  disconnect() {}
}

class FakeAudioContext {
  createAnalyser() { return new FakeAnalyser() }
  createMediaStreamSource() { return { connect: vi.fn(), disconnect: vi.fn() } }
  close() { return Promise.resolve() }
}

beforeEach(() => {
  mockVolume = 0
  vi.stubGlobal('AudioContext', FakeAudioContext)
  // rAF síncrono controlado manualmente via vi timers
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function fakeStream(): MediaStream {
  return { getAudioTracks: () => [{}] } as unknown as MediaStream
}

describe('useSilenceDetection', () => {
  it('calls onSilence after the silence threshold elapses', () => {
    const onSilence = vi.fn()
    const onSpeech = vi.fn()
    mockVolume = 0 // silêncio

    renderHook(() =>
      useSilenceDetection({
        stream: fakeStream(),
        active: true,
        silenceMs: 2500,
        threshold: 0.05,
        onSilence,
        onSpeech,
      }),
    )

    vi.advanceTimersByTime(3000)
    expect(onSilence).toHaveBeenCalledTimes(1)
    expect(onSpeech).not.toHaveBeenCalled()
  })

  it('calls onSpeech immediately when volume rises after silence', () => {
    const onSilence = vi.fn()
    const onSpeech = vi.fn()
    mockVolume = 0

    renderHook(() =>
      useSilenceDetection({
        stream: fakeStream(),
        active: true,
        silenceMs: 2500,
        threshold: 0.05,
        onSilence,
        onSpeech,
      }),
    )

    vi.advanceTimersByTime(3000) // entra em silêncio
    mockVolume = 0.5 // voz
    vi.advanceTimersByTime(300)
    expect(onSpeech).toHaveBeenCalledTimes(1)
  })

  it('does nothing when active is false', () => {
    const onSilence = vi.fn()
    mockVolume = 0
    renderHook(() =>
      useSilenceDetection({
        stream: fakeStream(),
        active: false,
        silenceMs: 2500,
        threshold: 0.05,
        onSilence,
        onSpeech: vi.fn(),
      }),
    )
    vi.advanceTimersByTime(3000)
    expect(onSilence).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/hooks/use-silence-detection.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/hooks/use-silence-detection.ts
import { useEffect, useRef } from 'react'

interface UseSilenceDetectionArgs {
  stream: MediaStream | null
  active: boolean
  silenceMs: number
  threshold: number // 0..1 (fração da escala)
  onSilence: () => void
  onSpeech: () => void
}

const POLL_INTERVAL_MS = 200

export function useSilenceDetection({
  stream,
  active,
  silenceMs,
  threshold,
  onSilence,
  onSpeech,
}: UseSilenceDetectionArgs) {
  const silentSinceRef = useRef<number | null>(null)
  const inSilenceRef = useRef(false)

  // Mantém callbacks atualizados sem reiniciar o efeito.
  const onSilenceRef = useRef(onSilence)
  const onSpeechRef = useRef(onSpeech)
  onSilenceRef.current = onSilence
  onSpeechRef.current = onSpeech

  useEffect(() => {
    if (!active || !stream) return
    if (typeof AudioContext === 'undefined') return // degradação graciosa

    const ctx = new AudioContext()
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    source.connect(analyser)

    const data = new Uint8Array(analyser.frequencyBinCount)
    silentSinceRef.current = null
    inSilenceRef.current = false

    const interval = setInterval(() => {
      analyser.getByteTimeDomainData(data)
      // RMS normalizado: 128 é o centro (silêncio).
      let sumSq = 0
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128
        sumSq += v * v
      }
      const rms = Math.sqrt(sumSq / data.length)

      const now = Date.now()
      if (rms < threshold) {
        if (silentSinceRef.current === null) silentSinceRef.current = now
        if (!inSilenceRef.current && now - silentSinceRef.current >= silenceMs) {
          inSilenceRef.current = true
          onSilenceRef.current()
        }
      } else {
        silentSinceRef.current = null
        if (inSilenceRef.current) {
          inSilenceRef.current = false
          onSpeechRef.current()
        }
      }
    }, POLL_INTERVAL_MS)

    return () => {
      clearInterval(interval)
      source.disconnect()
      analyser.disconnect()
      void ctx.close()
    }
  }, [stream, active, silenceMs, threshold])
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/hooks/use-silence-detection.test.ts`
Expected: PASS (3 passing).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-silence-detection.ts src/hooks/use-silence-detection.test.ts
git commit -m "feat(audio): hook de deteccao de silencio (VAD nativo)"
```

---

## Task 4: Hook de Wake Lock

**Files:**
- Create: `src/hooks/use-wake-lock.ts`
- Test: `src/hooks/use-wake-lock.test.ts`

O hook expõe `acquire()` e `release()` e re-adquire automaticamente no `visibilitychange` enquanto `enabled` for true.

- [ ] **Step 1: Write the failing test**

```typescript
// src/hooks/use-wake-lock.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWakeLock } from './use-wake-lock'

let releaseSpy: ReturnType<typeof vi.fn>
let requestSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  releaseSpy = vi.fn().mockResolvedValue(undefined)
  requestSpy = vi.fn().mockResolvedValue({ release: releaseSpy, released: false })
  vi.stubGlobal('navigator', { wakeLock: { request: requestSpy } })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useWakeLock', () => {
  it('requests a screen wake lock on acquire', async () => {
    const { result } = renderHook(() => useWakeLock())
    await act(async () => { await result.current.acquire() })
    expect(requestSpy).toHaveBeenCalledWith('screen')
  })

  it('releases the wake lock on release', async () => {
    const { result } = renderHook(() => useWakeLock())
    await act(async () => { await result.current.acquire() })
    await act(async () => { await result.current.release() })
    expect(releaseSpy).toHaveBeenCalledTimes(1)
  })

  it('releases the wake lock on unmount', async () => {
    const { result, unmount } = renderHook(() => useWakeLock())
    await act(async () => { await result.current.acquire() })
    unmount()
    expect(releaseSpy).toHaveBeenCalled()
  })

  it('does not throw when wakeLock API is unavailable', async () => {
    vi.stubGlobal('navigator', {})
    const { result } = renderHook(() => useWakeLock())
    await expect(result.current.acquire()).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/hooks/use-wake-lock.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/hooks/use-wake-lock.ts
import { useCallback, useEffect, useRef } from 'react'

interface WakeLockSentinelLike {
  release: () => Promise<void>
  released: boolean
}

export function useWakeLock() {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null)
  const wantLockRef = useRef(false)

  const acquire = useCallback(async () => {
    wantLockRef.current = true
    const wl = (navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> }
    }).wakeLock
    if (!wl) return // degradação graciosa
    try {
      sentinelRef.current = await wl.request('screen')
    } catch {
      // Falha silenciosa: a rede de seguranca de interrupcao assume.
    }
  }, [])

  const release = useCallback(async () => {
    wantLockRef.current = false
    if (sentinelRef.current) {
      try { await sentinelRef.current.release() } catch { /* noop */ }
      sentinelRef.current = null
    }
  }, [])

  // Re-adquire ao voltar de segundo plano se ainda quisermos o lock.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && wantLockRef.current) {
        void acquire()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      if (sentinelRef.current) {
        void sentinelRef.current.release().catch(() => {})
        sentinelRef.current = null
      }
    }
  }, [acquire])

  return { acquire, release }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/hooks/use-wake-lock.test.ts`
Expected: PASS (4 passing).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-wake-lock.ts src/hooks/use-wake-lock.test.ts
git commit -m "feat(audio): hook de wake lock para manter tela ativa na gravacao"
```

---

## Task 5: Hook de detecção de interrupção

**Files:**
- Create: `src/hooks/use-recording-interruption.ts`
- Test: `src/hooks/use-recording-interruption.test.ts`

Define o tipo de motivo e escuta `track.onended` + visibilidade recente para classificar a causa.

- [ ] **Step 1: Write the failing test**

```typescript
// src/hooks/use-recording-interruption.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRecordingInterruption } from './use-recording-interruption'

class FakeTrack {
  onended: (() => void) | null = null
  listeners: Record<string, (() => void)[]> = {}
  addEventListener(ev: string, cb: () => void) {
    (this.listeners[ev] ??= []).push(cb)
  }
  removeEventListener() {}
  fireEnded() { this.listeners['ended']?.forEach(cb => cb()) }
}

function fakeStream(track: FakeTrack): MediaStream {
  return { getAudioTracks: () => [track] } as unknown as MediaStream
}

let visibility = 'visible'

beforeEach(() => {
  visibility = 'visible'
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  })
})

afterEach(() => { vi.restoreAllMocks() })

describe('useRecordingInterruption', () => {
  it('reports "suspended" when track ends after a recent hidden event', () => {
    const onInterrupt = vi.fn()
    const track = new FakeTrack()
    renderHook(() =>
      useRecordingInterruption({ stream: fakeStream(track), active: true, onInterrupt }),
    )

    // Simula a aba ficando oculta (hibernacao) e depois a track morre.
    visibility = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    track.fireEnded()

    expect(onInterrupt).toHaveBeenCalledWith('suspended')
  })

  it('reports "mic-disconnected" when track ends without a hidden event', () => {
    const onInterrupt = vi.fn()
    const track = new FakeTrack()
    renderHook(() =>
      useRecordingInterruption({ stream: fakeStream(track), active: true, onInterrupt }),
    )
    track.fireEnded()
    expect(onInterrupt).toHaveBeenCalledWith('mic-disconnected')
  })

  it('does not fire when inactive', () => {
    const onInterrupt = vi.fn()
    const track = new FakeTrack()
    renderHook(() =>
      useRecordingInterruption({ stream: fakeStream(track), active: false, onInterrupt }),
    )
    track.fireEnded()
    expect(onInterrupt).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/hooks/use-recording-interruption.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/hooks/use-recording-interruption.ts
import { useEffect, useRef } from 'react'

export type InterruptionReason = 'suspended' | 'mic-disconnected' | 'backgrounded'

// Janela em que um evento "hidden" recente indica suspensao do sistema.
const RECENT_HIDDEN_WINDOW_MS = 4000

interface UseRecordingInterruptionArgs {
  stream: MediaStream | null
  active: boolean
  onInterrupt: (reason: InterruptionReason) => void
}

export const INTERRUPTION_MESSAGES: Record<InterruptionReason, string> = {
  suspended: 'O computador entrou em suspensão',
  'mic-disconnected': 'O microfone foi desconectado',
  backgrounded: 'O app ficou em segundo plano',
}

export function useRecordingInterruption({
  stream,
  active,
  onInterrupt,
}: UseRecordingInterruptionArgs) {
  const lastHiddenAtRef = useRef<number | null>(null)
  const onInterruptRef = useRef(onInterrupt)
  onInterruptRef.current = onInterrupt

  useEffect(() => {
    if (!active || !stream) return
    const track = stream.getAudioTracks()[0]
    if (!track) return

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        lastHiddenAtRef.current = Date.now()
      }
    }

    const onEnded = () => {
      const hiddenRecently =
        lastHiddenAtRef.current !== null &&
        Date.now() - lastHiddenAtRef.current < RECENT_HIDDEN_WINDOW_MS
      onInterruptRef.current(hiddenRecently ? 'suspended' : 'mic-disconnected')
    }

    document.addEventListener('visibilitychange', onVisibility)
    track.addEventListener('ended', onEnded)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      track.removeEventListener('ended', onEnded)
    }
  }, [stream, active])
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/hooks/use-recording-interruption.test.ts`
Expected: PASS (3 passing).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-recording-interruption.ts src/hooks/use-recording-interruption.test.ts
git commit -m "feat(audio): hook de deteccao de interrupcao da gravacao"
```

---

## Task 6: Multi-segmento em step-audio (refatorar `chunksRef` → `segmentsRef`)

**Files:**
- Modify: `src/components/steps/step-audio.tsx`
- Test: `src/components/steps/step-audio.test.tsx` (adicionar caso)

Hoje `onstop` cria um único `Blob` de `chunksRef`. Vamos manter `chunksRef` para o segmento atual, mas acumular cada segmento finalizado em `segmentsRef`, e concatenar tudo no envio.

- [ ] **Step 1: Add a failing test for multi-segment concatenation**

Adicionar em `src/components/steps/step-audio.test.tsx` (seguir o padrão de mocks de `MediaRecorder`/`getUserMedia` já existente no arquivo — reutilizar os helpers que ele já define). Caso:

```typescript
  it('concatenates multiple recorded segments into a single upload', async () => {
    // Arrange: mock fetch para capturar o FormData enviado
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('texto\n__DONE__\n', { status: 200 }),
    )

    // (usar os helpers do arquivo para: iniciar gravacao, parar -> segmento 1,
    //  continuar gravacao, parar -> segmento 2, depois transcrever)
    // ... acionar fluxo de 2 segmentos e clicar em "Transcrever" ...

    const sentForm = fetchSpy.mock.calls[0][1]?.body as FormData
    const audio = sentForm.get('audio') as File
    // Os 2 segmentos viram 1 unico blob nao-vazio.
    expect(audio.size).toBeGreaterThan(0)
  })
```

> Nota ao implementador: ajuste o disparo do fluxo aos helpers já presentes no `step-audio.test.tsx`. O essencial verificado é: **um único `audio` é enviado** após dois segmentos.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/components/steps/step-audio.test.tsx`
Expected: FAIL — só o último segmento é enviado (ou o teste não encontra 2 segmentos).

- [ ] **Step 3: Implement segment accumulation**

Em `src/components/steps/step-audio.tsx`:

Adicionar ref ao lado de `chunksRef`:

```typescript
  const segmentsRef = useRef<Blob[]>([])
```

No `onstop` (atualmente cria `recordedBlob` de `chunksRef`), acumular o segmento:

```typescript
    recorder.onstop = () => {
      const segment = new Blob(chunksRef.current, { type: 'audio/webm' })
      if (segment.size > 0) segmentsRef.current.push(segment)
      const combined = new Blob(segmentsRef.current, { type: 'audio/webm' })
      setRecordedBlob(combined)
      setRecordState('recorded')
      stopMicrophoneTrack()
      resetTimer()
    }
```

Em `handleReset`, limpar os segmentos:

```typescript
    segmentsRef.current = []
```

Em `beginRecording`, ao iniciar um **novo** segmento (continuar), **não** zerar `segmentsRef` (só `chunksRef`):

```typescript
  function beginRecording(stream: MediaStream) {
    chunksRef.current = []
    const recorder = new MediaRecorder(stream)
    // ... resto inalterado
  }
```

> Garantir que `chunksRef.current = []` aconteça em `beginRecording` (início de cada segmento) e que `segmentsRef` só seja zerado em `handleReset`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/components/steps/step-audio.test.tsx`
Expected: PASS (incluindo o novo caso). Rodar a suíte completa do arquivo para garantir que os testes de gravação existentes seguem verdes.

- [ ] **Step 5: Commit**

```bash
git add src/components/steps/step-audio.tsx src/components/steps/step-audio.test.tsx
git commit -m "feat(audio): suporte a gravacao em multiplos segmentos concatenados"
```

---

## Task 7: Orquestrar hooks em step-audio (VAD auto-pausa, Wake Lock, interrupção + UI)

**Files:**
- Modify: `src/components/steps/step-audio.tsx`
- Test: `src/components/steps/step-audio.test.tsx` (adicionar casos)

Constantes novas no topo do componente:

```typescript
const SILENCE_THRESHOLD = 0.05
const SILENCE_MS = 2500
```

Estado novo:

```typescript
  const [autoPaused, setAutoPaused] = useState(false)
  const [interruption, setInterruption] = useState<InterruptionReason | null>(null)
```

- [ ] **Step 1: Add failing tests for auto-pause indicator and interruption message**

Adicionar em `src/components/steps/step-audio.test.tsx`:

```typescript
  it('shows the auto-pause indicator when silence is detected', async () => {
    // mockar useSilenceDetection para invocar onSilence imediatamente
    // (vi.mock no topo do arquivo de teste — ver Step 3)
    // ... iniciar gravacao ...
    expect(await screen.findByText(/pausado automaticamente/i)).toBeInTheDocument()
  })

  it('shows a reason-specific message when recording is interrupted', async () => {
    // mockar useRecordingInterruption para invocar onInterrupt('suspended')
    // ... iniciar gravacao ...
    expect(
      await screen.findByText(/o computador entrou em suspensão/i),
    ).toBeInTheDocument()
    expect(await screen.findByText(/foi preservado/i)).toBeInTheDocument()
  })
```

No topo do arquivo de teste, mockar os hooks para controlar os callbacks:

```typescript
vi.mock('@/hooks/use-silence-detection', () => ({
  useSilenceDetection: ({ active, onSilence }: { active: boolean; onSilence: () => void }) => {
    if (active) setTimeout(onSilence, 0)
  },
}))
vi.mock('@/hooks/use-recording-interruption', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/use-recording-interruption')>(
    '@/hooks/use-recording-interruption',
  )
  return {
    ...actual,
    useRecordingInterruption: ({ active, onInterrupt }: { active: boolean; onInterrupt: (r: 'suspended') => void }) => {
      if (active) setTimeout(() => onInterrupt('suspended'), 0)
    },
  }
})
vi.mock('@/hooks/use-wake-lock', () => ({
  useWakeLock: () => ({ acquire: vi.fn().mockResolvedValue(undefined), release: vi.fn().mockResolvedValue(undefined) }),
}))
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/components/steps/step-audio.test.tsx`
Expected: FAIL — textos não encontrados.

- [ ] **Step 3: Wire the hooks into the component**

Imports no topo de `step-audio.tsx`:

```typescript
import { useSilenceDetection } from '@/hooks/use-silence-detection'
import { useWakeLock } from '@/hooks/use-wake-lock'
import {
  useRecordingInterruption,
  INTERRUPTION_MESSAGES,
  type InterruptionReason,
} from '@/hooks/use-recording-interruption'
```

Dentro do componente, após os refs existentes:

```typescript
  const { acquire: acquireWakeLock, release: releaseWakeLock } = useWakeLock()

  const isRecordingActive = recordState === 'recording' || recordState === 'paused'

  useSilenceDetection({
    stream: mediaStreamRef.current,
    active: recordState === 'recording',
    silenceMs: SILENCE_MS,
    threshold: SILENCE_THRESHOLD,
    onSilence: () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.pause()
        pauseTimer()
        setAutoPaused(true)
      }
    },
    onSpeech: () => {
      if (mediaRecorderRef.current?.state === 'paused') {
        mediaRecorderRef.current.resume()
        startTimer()
        setAutoPaused(false)
      }
    },
  })

  useRecordingInterruption({
    stream: mediaStreamRef.current,
    active: isRecordingActive,
    onInterrupt: (reason) => {
      setInterruption(reason)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop() // onstop preserva o segmento
      }
      pauseTimer()
    },
  })
```

Em `beginRecording`, após `recorder.start(1000)`, adquirir o Wake Lock:

```typescript
    recorder.start(1000)
    void acquireWakeLock()
    startTimer()
    setRecordState('recording')
    setAutoPaused(false)
    setInterruption(null)
```

No `onstop`, liberar o Wake Lock (adicionar ao corpo existente):

```typescript
      void releaseWakeLock()
```

UI — dentro do bloco `recordState === 'recording'`, trocar o texto fixo "Gravando..." por condicional de auto-pausa:

```tsx
                  <span className="text-sm text-muted-foreground">
                    {autoPaused ? '⏸ Silêncio detectado — pausado automaticamente' : 'Gravando...'}
                  </span>
```

UI — adicionar o aviso de interrupção logo acima dos botões do modo gravação (quando `interruption` não for null):

```tsx
            {interruption && (
              <div
                data-testid="interruption-alert"
                className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive"
              >
                A gravação foi interrompida porque {INTERRUPTION_MESSAGES[interruption].toLowerCase()}.
                O áudio até {formatTimer(elapsedMs)} foi preservado. Continue gravando para anexar
                um novo trecho ou transcreva o que já foi capturado.
              </div>
            )}
```

> Quando `interruption` é setado, o `onstop` já levou `recordState` para `'recorded'`, exibindo os botões "Transcrever" / "Regravar". O botão de continuar gravando é o fluxo de iniciar nova gravação (novo segmento), que já acumula em `segmentsRef` (Task 6). Garantir que iniciar nova gravação limpe `interruption` (já feito em `beginRecording` acima via `setInterruption(null)`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/components/steps/step-audio.test.tsx`
Expected: PASS (todos, incluindo os 2 novos). Rodar `pnpm test` para garantir que nada quebrou nos demais.

- [ ] **Step 5: Commit**

```bash
git add src/components/steps/step-audio.tsx src/components/steps/step-audio.test.tsx
git commit -m "feat(audio): VAD auto-pausa, wake lock e aviso de interrupcao no fluxo de gravacao"
```

---

## Task 8: E2E — interrupção preserva e avisa

**Files:**
- Modify: `e2e/specs/app/consultation.spec.ts`
- Referência: `e2e/fixtures/mocks.ts` (mocks de IA/mídia existentes)

- [ ] **Step 1: Write the failing E2E test**

Adicionar um spec que: entra no fluxo de consulta até a etapa de áudio, inicia a gravação (modo "Gravar consulta"), simula a track de áudio terminando, e valida que o aviso de interrupção aparece. Usar **sinais observáveis** (o `data-testid="interruption-alert"`), nunca `waitForTimeout`.

```typescript
test('exibe aviso quando a gravação é interrompida e preserva o trecho', async ({ page }) => {
  // ... setup de auth + seed + navegacao ate a etapa de audio (reusar fixtures existentes) ...

  // Garantir microfone mockado nas permissoes do contexto (ver e2e/fixtures).
  await page.getByRole('tab', { name: /gravar consulta/i }).click()
  await page.getByRole('button', { name: /iniciar gravação/i }).click()

  // Aguardar o estado "Gravando..." (apos countdown) — sinal observavel.
  await expect(page.getByTestId('record-timer')).toBeVisible()

  // Simular a track de audio morrendo (hibernacao).
  await page.evaluate(() => {
    const stream = (window as unknown as { __lastMediaStream?: MediaStream }).__lastMediaStream
    stream?.getAudioTracks().forEach(t => t.dispatchEvent(new Event('ended')))
  })

  await expect(page.getByTestId('interruption-alert')).toBeVisible()
  await expect(page.getByTestId('interruption-alert')).toContainText(/foi preservado/i)
})
```

> Nota ao implementador: para o `page.evaluate` acima funcionar, o mock de mídia em `e2e/fixtures/mocks.ts` deve expor a última `MediaStream` em `window.__lastMediaStream` ao interceptar `getUserMedia`. Se a fixture atual não fizer isso, adicionar essa exposição na fixture (apenas em ambiente de teste). Caso o time prefira não tocar a fixture, classificar este teste como `test.fixme` documentando o motivo — mas a abordagem preferida é expor a stream.

- [ ] **Step 2: Run E2E to verify it fails**

Run: `pnpm run test:e2e -- consultation`
Expected: FAIL — `interruption-alert` não encontrado (antes do wiring) ou stream não exposta.

- [ ] **Step 3: Make it pass**

Garantir que a fixture de mídia exponha `window.__lastMediaStream` e que o wiring da Task 7 esteja presente. Sem código de produção novo além do já feito.

- [ ] **Step 4: Run E2E to verify it passes**

Run: `pnpm run test:e2e -- consultation`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add e2e/specs/app/consultation.spec.ts e2e/fixtures/mocks.ts
git commit -m "test(e2e): valida aviso de interrupcao na gravacao"
```

---

## Task 9: Documentação (architecture + build-doc)

**Files:**
- Modify: `docs/architecture.md`
- Create: `build-docs/2026-05-27/2026-05-27-robustez-gravacao.md`

- [ ] **Step 1: Atualizar architecture.md**

Localizar o diagrama do fluxo de gravação/transcrição em `docs/architecture.md` e adicionar/ajustar para refletir: VAD auto-pausa, Wake Lock no ciclo de gravação, detecção de interrupção com motivo, e multi-segmento concatenado. Manter o padrão Mermaid existente do arquivo.

- [ ] **Step 2: Criar o build-doc**

Criar `build-docs/2026-05-27/2026-05-27-robustez-gravacao.md` documentando: contexto (cena do cliente), causa raiz (alucinação em silêncio + sem resiliência), o que foi entregue (filtro, hardening Whisper, VAD, Wake Lock, interrupção, multi-segmento), arquivos criados/modificados e a cobertura de testes. Seguir o formato dos build-docs em `build-docs/2026-05-26/`.

- [ ] **Step 3: Rodar a suíte completa**

Pedir ao usuário (não rodar build): rodar `pnpm run test:all` e colar erros relevantes, se houver. Corrigir o que aparecer.

- [ ] **Step 4: Commit**

```bash
git add docs/architecture.md build-docs/2026-05-27/2026-05-27-robustez-gravacao.md
git commit -m "docs: atualiza arquitetura e build-doc de robustez da gravacao"
```

---

## Self-Review (preenchido pelo autor do plano)

- **Cobertura do spec:** VAD (Task 3+7) · Wake Lock + liberação (Task 4+7) · interrupção/motivo + preservar/avisar (Task 5+7) · multi-segmento (Task 6) · hardening Whisper + filtro (Task 1+2) · upload protegido pelo filtro (Task 2) · testes unit/integração/E2E (Tasks 1-8) · architecture.md + build-doc (Task 9). ✅ Sem lacunas.
- **Placeholders:** os pontos com "ajustar aos helpers do arquivo" (Tasks 6, 7, 8) referem-se a reutilizar mocks de `MediaRecorder`/`getUserMedia` já existentes em `step-audio.test.tsx` e `e2e/fixtures/mocks.ts` — o comportamento a verificar está explícito; não é TODO de design.
- **Consistência de tipos:** `InterruptionReason` e `INTERRUPTION_MESSAGES` definidos na Task 5 e consumidos na Task 7 com os mesmos nomes. `segmentsRef`/`chunksRef` consistentes entre Tasks 6 e 7. `acquire`/`release` do `useWakeLock` idem.
```
