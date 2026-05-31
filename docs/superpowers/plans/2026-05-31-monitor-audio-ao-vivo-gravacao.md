# Monitor de Áudio ao Vivo na Gravação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar feedback visual de áudio ao vivo (onda sonora + aviso de microfone baixo) na etapa de gravação da consulta, sem alterar nenhuma lógica de gravação/VAD/transcrição existente.

**Architecture:** Camada puramente visual por cima do fluxo atual. Um hook novo `useAudioLevel` lê o volume (RMS) da mesma `MediaStream` do microfone e o reporta via callback. Um componente novo `<AudioWaveform>` desenha a onda num `<canvas>` a partir do nível + estado. O `step-audio.tsx` integra os dois e deriva o aviso de "mic baixo" a partir do nível sustentado. Falha de qualquer peça nova degrada graciosamente — a gravação nunca para.

**Tech Stack:** React 19 · TypeScript · Web Audio API (`AudioContext` / `AnalyserNode`) · `<canvas>` + `requestAnimationFrame` · Vitest + RTL · Playwright (E2E mobile).

**Referência:** spec em `docs/superpowers/specs/2026-05-31-monitor-audio-ao-vivo-gravacao-design.md`.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `src/hooks/use-audio-level.ts` | **Novo.** Lê a stream e reporta o nível de volume (0..1) via `onLevel`. Responsabilidade única: medir nível. |
| `src/hooks/use-audio-level.test.ts` | **Novo.** Testes unitários do hook. |
| `src/components/steps/audio-waveform.tsx` | **Novo.** Desenha a onda no `<canvas>` a partir de `level` + `variant`. Não conhece gravação. |
| `src/components/steps/audio-waveform.test.tsx` | **Novo.** Testes unitários do componente. |
| `src/components/steps/step-audio.tsx` | **Modificar.** Integrar `useAudioLevel` + `<AudioWaveform>`; derivar e exibir o aviso de mic baixo. |
| `src/components/steps/step-audio.test.tsx` | **Modificar.** Mock de `useAudioLevel`; testes de integração da onda e do aviso. |
| `e2e/specs/app/consultation.spec.ts` | **Modificar.** Asserção da onda visível durante gravação no viewport mobile. |
| `docs/architecture.md` | **Modificar.** Atualizar o diagrama da etapa de áudio/gravação. |
| `build-docs/2026-05-31/2026-05-31-monitor-audio-ao-vivo-gravacao.md` | **Novo.** Documento de build da entrega. |

**Decisões de design travadas:**
- O aviso de "mic baixo" vive no `step-audio.tsx` (camada de layout/UX), **não** no `<AudioWaveform>` (que só desenha). Separação de responsabilidade.
- `useAudioLevel` é um hook separado do `useSilenceDetection` — cada um com responsabilidade única, ambos leem `mediaStreamRef.current`. Dois `AnalyserNode` na mesma stream é barato e aceitável.
- Em jsdom, `canvas.getContext('2d')` retorna `null`. O componente trata isso (não desenha, mas renderiza o elemento) → degradação graciosa testável.

---

### Task 1: Hook `useAudioLevel`

**Files:**
- Create: `src/hooks/use-audio-level.ts`
- Test: `src/hooks/use-audio-level.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Cria `src/hooks/use-audio-level.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAudioLevel } from './use-audio-level'

// AnalyserNode falso: getByteTimeDomainData preenche o buffer com um valor fixo
// (128 = silêncio/centro; quanto mais longe de 128, maior o RMS).
function makeFakeAnalyser(sampleValue: number) {
  return {
    fftSize: 0,
    frequencyBinCount: 16,
    getByteTimeDomainData: (data: Uint8Array) => {
      data.fill(sampleValue)
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
}

function stubAudioContext(sampleValue: number) {
  const analyser = makeFakeAnalyser(sampleValue)
  class FakeAudioContext {
    createMediaStreamSource() { return { connect: vi.fn(), disconnect: vi.fn() } }
    createAnalyser() { return analyser }
    close() { return Promise.resolve() }
  }
  vi.stubGlobal('AudioContext', FakeAudioContext)
  return analyser
}

const fakeStream = { } as unknown as MediaStream

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useAudioLevel', () => {
  it('reporta nível ~0 quando o áudio está no centro (silêncio)', () => {
    vi.useFakeTimers()
    stubAudioContext(128) // centro = silêncio
    const onLevel = vi.fn()
    renderHook(() => useAudioLevel({ stream: fakeStream, active: true, onLevel }))

    vi.advanceTimersByTime(200)

    expect(onLevel).toHaveBeenCalled()
    const last = onLevel.mock.calls.at(-1)![0] as number
    expect(last).toBeCloseTo(0, 2)
  })

  it('reporta nível > 0 quando há sinal de áudio', () => {
    vi.useFakeTimers()
    stubAudioContext(200) // longe do centro = volume alto
    const onLevel = vi.fn()
    renderHook(() => useAudioLevel({ stream: fakeStream, active: true, onLevel }))

    vi.advanceTimersByTime(200)

    const last = onLevel.mock.calls.at(-1)![0] as number
    expect(last).toBeGreaterThan(0.1)
  })

  it('não reporta quando inativo', () => {
    vi.useFakeTimers()
    stubAudioContext(200)
    const onLevel = vi.fn()
    renderHook(() => useAudioLevel({ stream: fakeStream, active: false, onLevel }))

    vi.advanceTimersByTime(500)

    expect(onLevel).not.toHaveBeenCalled()
  })

  it('degrada graciosamente quando AudioContext não existe', () => {
    vi.useFakeTimers()
    vi.stubGlobal('AudioContext', undefined)
    const onLevel = vi.fn()
    expect(() =>
      renderHook(() => useAudioLevel({ stream: fakeStream, active: true, onLevel })),
    ).not.toThrow()
    vi.advanceTimersByTime(500)
    expect(onLevel).not.toHaveBeenCalled()
  })

  it('limpa o AudioContext no unmount', () => {
    vi.useFakeTimers()
    const analyser = stubAudioContext(200)
    const onLevel = vi.fn()
    const { unmount } = renderHook(() =>
      useAudioLevel({ stream: fakeStream, active: true, onLevel }),
    )
    unmount()
    expect(analyser.disconnect).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `pnpm test -- use-audio-level`
Expected: FAIL — `useAudioLevel is not a function` / arquivo não encontrado.

- [ ] **Step 3: Implementar o hook mínimo**

Cria `src/hooks/use-audio-level.ts`:

```typescript
import { useEffect, useRef } from 'react'

interface UseAudioLevelArgs {
  stream: MediaStream | null
  active: boolean
  onLevel: (level: number) => void
}

const POLL_INTERVAL_MS = 100

/**
 * Lê o volume (RMS normalizado 0..1) da stream do microfone e reporta via onLevel.
 * Responsabilidade única: medir nível para feedback visual. Não decide silêncio
 * (isso é do useSilenceDetection) nem grava (isso é do MediaRecorder).
 */
export function useAudioLevel({ stream, active, onLevel }: UseAudioLevelArgs) {
  const onLevelRef = useRef(onLevel)
  onLevelRef.current = onLevel

  useEffect(() => {
    if (!active || !stream) return
    if (typeof AudioContext === 'undefined') return // degradação graciosa

    const ctx = new AudioContext()
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    source.connect(analyser)

    const data = new Uint8Array(analyser.frequencyBinCount)

    const interval = setInterval(() => {
      analyser.getByteTimeDomainData(data)
      let sumSq = 0
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128
        sumSq += v * v
      }
      const rms = Math.sqrt(sumSq / data.length)
      onLevelRef.current(rms)
    }, POLL_INTERVAL_MS)

    return () => {
      clearInterval(interval)
      source.disconnect()
      analyser.disconnect()
      void ctx.close()
    }
  }, [stream, active])
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `pnpm test -- use-audio-level`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-audio-level.ts src/hooks/use-audio-level.test.ts
git commit -m "feat(gravacao): hook useAudioLevel para nivel de volume ao vivo"
```

---

### Task 2: Componente `<AudioWaveform>`

**Files:**
- Create: `src/components/steps/audio-waveform.tsx`
- Test: `src/components/steps/audio-waveform.test.tsx`

`variant` reflete o estado da gravação: `'recording'` (onda viva), `'silence'` (achatada), `'paused'` (congelada/esmaecida).

- [ ] **Step 1: Escrever o teste que falha**

Cria `src/components/steps/audio-waveform.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AudioWaveform } from './audio-waveform'

describe('AudioWaveform', () => {
  it('renderiza um canvas com label acessível', () => {
    render(<AudioWaveform level={0.3} variant="recording" />)
    expect(screen.getByLabelText(/visualizador de áudio/i)).toBeInTheDocument()
  })

  it('expõe o estado atual via data-variant (recording)', () => {
    render(<AudioWaveform level={0.3} variant="recording" />)
    expect(screen.getByTestId('audio-waveform')).toHaveAttribute('data-variant', 'recording')
  })

  it('expõe data-variant silence', () => {
    render(<AudioWaveform level={0} variant="silence" />)
    expect(screen.getByTestId('audio-waveform')).toHaveAttribute('data-variant', 'silence')
  })

  it('expõe data-variant paused', () => {
    render(<AudioWaveform level={0} variant="paused" />)
    expect(screen.getByTestId('audio-waveform')).toHaveAttribute('data-variant', 'paused')
  })

  it('não quebra quando o contexto 2d do canvas é nulo (jsdom)', () => {
    expect(() => render(<AudioWaveform level={0.5} variant="recording" />)).not.toThrow()
  })

  it('canvas usa largura fluida (w-full) para responsividade', () => {
    render(<AudioWaveform level={0.3} variant="recording" />)
    expect(screen.getByLabelText(/visualizador de áudio/i)).toHaveClass('w-full')
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `pnpm test -- audio-waveform`
Expected: FAIL — módulo `./audio-waveform` não encontrado.

- [ ] **Step 3: Implementar o componente mínimo**

Cria `src/components/steps/audio-waveform.tsx`:

```typescript
'use client'
import { useEffect, useRef } from 'react'

export type WaveformVariant = 'recording' | 'silence' | 'paused'

interface AudioWaveformProps {
  /** Nível de volume atual, 0..1. */
  level: number
  variant: WaveformVariant
}

const BAR_COUNT = 48

/**
 * Onda sonora ao vivo desenhada em canvas. Apenas apresentação: recebe o nível
 * e o estado, desenha. Não conhece gravação nem transcrição. Se o contexto 2d
 * não existir (jsdom/ambiente sem canvas), apenas não desenha — não quebra.
 */
export function AudioWaveform({ level, variant }: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const levelRef = useRef(level)
  levelRef.current = level
  const barsRef = useRef<number[]>(new Array(BAR_COUNT).fill(0))
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return // degradação graciosa (jsdom)

    let running = true

    const draw = () => {
      if (!running) return
      const { width, height } = canvas
      ctx.clearRect(0, 0, width, height)

      // Empurra o nível atual na fila de barras (efeito de rolagem da onda).
      const bars = barsRef.current
      const sample = variant === 'recording' ? Math.min(1, levelRef.current * 3) : 0
      bars.push(sample)
      bars.shift()

      const barWidth = width / BAR_COUNT
      const mid = height / 2

      // Cor por estado.
      if (variant === 'paused') {
        ctx.fillStyle = 'rgba(148,148,160,0.5)' // cinza esmaecido
      } else {
        const grad = ctx.createLinearGradient(0, 0, width, 0)
        grad.addColorStop(0, '#8B5CF6')
        grad.addColorStop(1, '#06B6D4')
        ctx.fillStyle = grad
      }

      for (let i = 0; i < bars.length; i++) {
        const amp = variant === 'silence' || variant === 'paused' ? 0.02 : bars[i]
        const barHeight = Math.max(2, amp * height)
        ctx.fillRect(i * barWidth, mid - barHeight / 2, barWidth * 0.6, barHeight)
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => {
      running = false
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [variant])

  return (
    <canvas
      ref={canvasRef}
      data-testid="audio-waveform"
      data-variant={variant}
      aria-label="Visualizador de áudio da gravação"
      role="img"
      width={600}
      height={64}
      className="w-full h-16 rounded-lg bg-white/[0.03] border border-border"
    />
  )
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `pnpm test -- audio-waveform`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add src/components/steps/audio-waveform.tsx src/components/steps/audio-waveform.test.tsx
git commit -m "feat(gravacao): componente AudioWaveform da onda sonora ao vivo"
```

---

### Task 3: Integrar a onda no `step-audio` (estados recording/silence/paused)

**Files:**
- Modify: `src/components/steps/step-audio.tsx`
- Test: `src/components/steps/step-audio.test.tsx`

- [ ] **Step 1: Adicionar o mock de `useAudioLevel` no teste e escrever os testes que falham**

Em `src/components/steps/step-audio.test.tsx`, adicionar ao bloco de mocks de hooks (após o mock de `use-silence-detection`, por volta da linha 58) um ref controlável e o mock:

```typescript
let _triggerLevel: ((level: number) => void) | null = null

vi.mock('@/hooks/use-audio-level', () => ({
  useAudioLevel: ({
    active,
    onLevel,
  }: {
    active: boolean
    onLevel: (level: number) => void
  }) => {
    _triggerLevel = active ? onLevel : null
  },
}))
```

E no `beforeEach` (junto dos outros resets, ~linha 168) adicionar:

```typescript
  _triggerLevel = null
```

Adicionar um novo bloco de testes ao final do arquivo:

```typescript
describe('StepAudio — onda sonora ao vivo', () => {
  it('exibe a onda durante a gravação', async () => {
    renderStepAudio()
    await switchToRecordMode()
    await startRecording(makeMockStream())
    expect(screen.getByTestId('audio-waveform')).toHaveAttribute('data-variant', 'recording')
  })

  it('a onda fica em "silence" quando o VAD detecta silêncio', async () => {
    renderStepAudio()
    await switchToRecordMode()
    await startRecording(makeMockStream())
    await act(async () => { _triggerSilence?.() })
    expect(screen.getByTestId('audio-waveform')).toHaveAttribute('data-variant', 'silence')
  })

  it('a onda fica em "paused" na pausa manual', async () => {
    renderStepAudio()
    await switchToRecordMode()
    await startRecording(makeMockStream())
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^pausar$/i }))
    })
    expect(screen.getByTestId('audio-waveform')).toHaveAttribute('data-variant', 'paused')
  })

  it('não exibe a onda fora da gravação (idle)', async () => {
    renderStepAudio()
    await switchToRecordMode()
    expect(screen.queryByTestId('audio-waveform')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test -- step-audio`
Expected: FAIL — `audio-waveform` não está no DOM (componente ainda não integrado).

- [ ] **Step 3: Integrar no `step-audio.tsx`**

3a. Adicionar os imports (junto dos outros, topo do arquivo):

```typescript
import { useAudioLevel } from '@/hooks/use-audio-level'
import { AudioWaveform, type WaveformVariant } from '@/components/steps/audio-waveform'
```

3b. Adicionar o estado de nível (junto dos outros `useState`, ~linha 56):

```typescript
  const [audioLevel, setAudioLevel] = useState(0)
```

3c. Ligar o hook (logo após o bloco do `useSilenceDetection`, antes do `useRecordingInterruption`, ~linha 114):

```typescript
  useAudioLevel({
    stream: mediaStreamRef.current,
    active: isRecordingActive,
    onLevel: setAudioLevel,
  })
```

3d. Derivar o `variant` (junto das constantes derivadas, perto de `isRecordingActive`, ~linha 87):

```typescript
  const waveformVariant: WaveformVariant =
    recordState === 'paused' ? 'paused' : autoPaused ? 'silence' : 'recording'
```

3e. Renderizar a onda nos blocos `recording` e `paused`. No bloco `recordState === 'recording'` (~linha 567), inserir o componente logo após o `<div>` do timer/status (entre o bloco de status e o `<div className="flex gap-2">` dos botões):

```tsx
                <AudioWaveform level={audioLevel} variant={waveformVariant} />
```

3f. Repetir no bloco `recordState === 'paused'` (~linha 593), também entre o status e os botões:

```tsx
                <AudioWaveform level={audioLevel} variant="paused" />
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm test -- step-audio`
Expected: PASS — incluindo os 4 testes novos e todos os existentes (sem regressão).

- [ ] **Step 5: Commit**

```bash
git add src/components/steps/step-audio.tsx src/components/steps/step-audio.test.tsx
git commit -m "feat(gravacao): integra onda sonora ao vivo nos estados de gravacao"
```

---

### Task 4: Aviso de microfone baixo (discreto, auto-some)

**Files:**
- Modify: `src/components/steps/step-audio.tsx`
- Test: `src/components/steps/step-audio.test.tsx`

Regra: há voz (nível acima do silêncio de 5%) mas abaixo de ~12% por ~3s contínuos → mostra aviso âmbar. Volume normaliza → some.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao final de `src/components/steps/step-audio.test.tsx`:

```typescript
describe('StepAudio — aviso de microfone baixo', () => {
  const LOW = 0.08 // entre 0.05 (silêncio) e 0.12 (saudável)
  const OK = 0.3

  it('mostra aviso após volume baixo sustentado por ~3s', async () => {
    renderStepAudio()
    await switchToRecordMode()
    await startRecording(makeMockStream())

    await act(async () => {
      for (let i = 0; i < 35; i++) {
        _triggerLevel?.(LOW)
        await vi.advanceTimersByTimeAsync(100)
      }
    })

    expect(screen.getByText(/volume do microfone baixo/i)).toBeInTheDocument()
  })

  it('não mostra aviso se o volume está saudável', async () => {
    renderStepAudio()
    await switchToRecordMode()
    await startRecording(makeMockStream())

    await act(async () => {
      for (let i = 0; i < 35; i++) {
        _triggerLevel?.(OK)
        await vi.advanceTimersByTimeAsync(100)
      }
    })

    expect(screen.queryByText(/volume do microfone baixo/i)).not.toBeInTheDocument()
  })

  it('aviso some quando o volume normaliza', async () => {
    renderStepAudio()
    await switchToRecordMode()
    await startRecording(makeMockStream())

    await act(async () => {
      for (let i = 0; i < 35; i++) {
        _triggerLevel?.(LOW)
        await vi.advanceTimersByTimeAsync(100)
      }
    })
    expect(screen.getByText(/volume do microfone baixo/i)).toBeInTheDocument()

    await act(async () => {
      _triggerLevel?.(OK)
      await vi.advanceTimersByTimeAsync(100)
    })
    expect(screen.queryByText(/volume do microfone baixo/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test -- step-audio`
Expected: FAIL — texto "volume do microfone baixo" não existe.

- [ ] **Step 3: Implementar a lógica de aviso no `step-audio.tsx`**

3a. Adicionar as constantes de limiar (junto de `SILENCE_THRESHOLD`, ~linha 23):

```typescript
// Aviso de mic baixo: voz presente (acima do silêncio) mas fraca, sustentada.
const LOW_MIC_FLOOR = SILENCE_THRESHOLD // 0.05 — abaixo disso é silêncio (VAD trata)
const LOW_MIC_CEIL = 0.12 // acima disso é volume saudável
const LOW_MIC_SUSTAIN_MS = 3000
```

3b. Adicionar estado e ref (junto dos outros, ~linha 56):

```typescript
  const [lowMic, setLowMic] = useState(false)
  const lowMicSinceRef = useRef<number | null>(null)
```

3c. Trocar o `onLevel: setAudioLevel` do `useAudioLevel` (Task 3c) por um handler que também avalia o mic baixo:

```typescript
  useAudioLevel({
    stream: mediaStreamRef.current,
    active: isRecordingActive,
    onLevel: (lvl) => {
      setAudioLevel(lvl)
      const isLow = lvl > LOW_MIC_FLOOR && lvl < LOW_MIC_CEIL
      if (isLow) {
        const now = Date.now()
        if (lowMicSinceRef.current === null) lowMicSinceRef.current = now
        if (now - lowMicSinceRef.current >= LOW_MIC_SUSTAIN_MS) setLowMic(true)
      } else {
        lowMicSinceRef.current = null
        setLowMic(false)
      }
    },
  })
```

3d. Resetar `lowMic` ao sair da gravação — adicionar no `recorder.onstop` (junto do `resetTimer()`, ~linha 257) e no `handleReset` (~linha 337):

```typescript
    setLowMic(false)
    lowMicSinceRef.current = null
```

3e. Renderizar o aviso dentro do bloco `recordState === 'recording'`, logo abaixo do `<AudioWaveform>`:

```tsx
                {lowMic && (
                  <p
                    data-testid="low-mic-warning"
                    className="text-xs text-amber-400 flex items-start gap-1.5"
                  >
                    <span aria-hidden>⚠️</span>
                    Volume do microfone baixo — aproxime-se ou aumente o volume nas configurações.
                  </p>
                )}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm test -- step-audio`
Expected: PASS — 3 testes novos + todos os anteriores.

- [ ] **Step 5: Commit**

```bash
git add src/components/steps/step-audio.tsx src/components/steps/step-audio.test.tsx
git commit -m "feat(gravacao): aviso discreto de microfone baixo durante a gravacao"
```

---

### Task 5: E2E — onda visível na gravação (mobile 375)

**Files:**
- Modify: `e2e/specs/app/consultation.spec.ts`

Verifica que a onda aparece ao iniciar a gravação no viewport mobile, sem quebrar o layout. Reusar o mock de microfone/`getUserMedia` já existente na spec (procurar o teste de gravação atual e seguir o mesmo setup de permissão/stream fake).

- [ ] **Step 1: Localizar o teste de gravação existente**

Run: `pnpm exec playwright test --list e2e/specs/app/consultation.spec.ts`
Ler o teste que entra no modo "Gravar consulta" e copiar o setup de `getUserMedia` mockado (não reinventar).

- [ ] **Step 2: Escrever o teste E2E**

Adicionar à `consultation.spec.ts`, seguindo o padrão de fixtures/mocks do arquivo (auth + seed + mock de IA já existentes). Esqueleto:

```typescript
test('exibe a onda sonora ao iniciar a gravação (mobile)', async ({ page }) => {
  // ... reusar setup de auth/seed e navegação até a StepAudio (mesmo padrão dos testes vizinhos)
  await page.getByRole('tab', { name: /gravar consulta/i }).click()
  await page.getByRole('button', { name: /iniciar gravação/i }).click()
  // countdown 3..2..1
  await expect(page.getByTestId('audio-waveform')).toBeVisible({ timeout: 6000 })
  // sem scroll horizontal em 375px
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  )
  expect(overflow).toBe(true)
})
```

- [ ] **Step 3: Rodar no projeto mobile**

Run: `pnpm exec playwright test e2e/specs/app/consultation.spec.ts --project=mobile`
Expected: PASS. Se flaky por timing do countdown, ajustar o timeout do `toBeVisible` (não usar sleeps fixos).

- [ ] **Step 4: Commit**

```bash
git add e2e/specs/app/consultation.spec.ts
git commit -m "test(gravacao): e2e da onda sonora visivel na gravacao mobile"
```

> Revisar esta spec com o agente `@e2e-playwright-reviewer` (locators, esperas, flakiness).

---

### Task 6: Atualizar documentação de arquitetura

**Files:**
- Modify: `docs/architecture.md`

- [ ] **Step 1: Localizar o diagrama da etapa de áudio**

Run: `pnpm test -- --reporter=dot` (não — apenas localizar no arquivo). Abrir `docs/architecture.md` e achar o diagrama Mermaid da etapa de gravação/transcrição (`step-audio`).

- [ ] **Step 2: Adicionar os nós novos**

Incluir `useAudioLevel` e `AudioWaveform` no diagrama da `StepAudio`, mostrando que ambos leem a mesma `MediaStream` e que a onda é apenas apresentação (não envia áudio). Deixar explícito que a transcrição segue só no clique final.

- [ ] **Step 3: Commit**

```bash
git add docs/architecture.md
git commit -m "docs(arquitetura): adiciona onda sonora ao vivo no diagrama da gravacao"
```

---

### Task 7: Validação final + documento de build

**Files:**
- Create: `build-docs/2026-05-31/2026-05-31-monitor-audio-ao-vivo-gravacao.md`

- [ ] **Step 1: Rodar a suíte completa**

Pedir ao usuário (comando proibido de rodar pelo assistente):
> "Por favor, rode `pnpm run test:all` e cole aqui o resultado (ou só os erros, se houver)."
Expected: tudo verde.

- [ ] **Step 2: Revisões com agentes**

- `@ui-reviewer` — conformidade visual da onda e do aviso (tokens, dark, gradiente).
- `@responsive-reviewer` — 375/768/1280/1920, sem scroll horizontal, botões intactos.

- [ ] **Step 3: Escrever o documento de build**

Cria `build-docs/2026-05-31/2026-05-31-monitor-audio-ao-vivo-gravacao.md` documentando: objetivo, arquivos criados/alterados, decisões (waveform, aviso discreto, sem transcrição ao vivo), e o que NÃO mudou (rede de segurança).

- [ ] **Step 4: Commit**

```bash
git add build-docs/2026-05-31/2026-05-31-monitor-audio-ao-vivo-gravacao.md
git commit -m "docs(build): monitor de audio ao vivo na gravacao"
```

---

## Self-Review (preenchido)

**Cobertura do spec:**
- Objetivo / feedback visual → Tasks 2, 3 ✓
- Reuso do volume (não criar VAD novo) → Task 1 (`useAudioLevel` lê a stream; VAD intacto) ✓
- Hook separado do silêncio → Task 1 ✓
- Estados recording/silence/paused → Task 3 ✓
- Aviso de mic baixo discreto e auto-some → Task 4 ✓
- Layout faixa larga abaixo do status → Task 3 (3e/3f) ✓
- Responsividade 375/768/1280/1920 → `w-full` no canvas (Task 2) + E2E mobile (Task 5) + `@responsive-reviewer` (Task 7) ✓
- Degradação graciosa → Task 1 (AudioContext undefined) + Task 2 (canvas null) ✓
- Não mexer em VAD/transcrição/cota → nenhuma task altera essa lógica ✓
- TDD unit + integração + e2e → Tasks 1-2 (unit), 3-4 (integração), 5 (e2e) ✓
- Atualizar architecture.md → Task 6 ✓
- Build doc → Task 7 ✓

**Consistência de tipos:** `useAudioLevel({ stream, active, onLevel })` e `onLevel(level: number)` usados igual em Task 1, 3 e 4. `AudioWaveform({ level, variant })` com `WaveformVariant = 'recording' | 'silence' | 'paused'` consistente entre Task 2 e 3. `data-testid="audio-waveform"` e `data-testid="low-mic-warning"` consistentes nos testes.

**Placeholders:** nenhum — todo passo de código tem o código real; o único esqueleto parcial (Task 5) é por dependência de fixtures E2E existentes que devem ser reusadas, com instrução explícita de localizá-las.
