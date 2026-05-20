# Typewriter Transcription Effect — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Animar a exibição da transcrição de áudio palavra por palavra (typewriter effect) no `StepAudio`, em vez de exibir blocos de texto abruptamente.

**Architecture:** Adicionar `displayedText` state e uma fila de palavras (`wordQueueRef`) em `StepAudio`. Quando chunks chegam via stream, as palavras novas são enfileiradas e drenadas via `setInterval` a 30ms/palavra. O `<Textarea>` passa a exibir `displayedText` em vez do acumulador bruto.

**Tech Stack:** React 19 · TypeScript · `useState` · `useRef` · `setInterval`

---

## Files

- Modify: `src/components/steps/step-audio.tsx`

Nenhum outro arquivo é tocado.

---

### Task 1: Adicionar estado e refs de animação

**Files:**
- Modify: `src/components/steps/step-audio.tsx`

- [ ] **Step 1: Ler o arquivo atual**

Abrir `src/components/steps/step-audio.tsx` para entender o estado atual antes de editar.

- [ ] **Step 2: Adicionar imports e constante**

Logo após `import { toast } from 'sonner'`, adicionar a constante:

```ts
const TYPEWRITER_INTERVAL_MS = 30
```

- [ ] **Step 3: Adicionar novos refs e state dentro do componente**

Após `const [partialTranscript, setPartialTranscript] = useState(initialTranscript)`:

```ts
const [displayedText, setDisplayedText] = useState(initialTranscript)
const wordQueueRef = useRef<string[]>([])
const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
const lastWordCountRef = useRef(
  initialTranscript ? initialTranscript.split(' ').length : 0
)
```

- [ ] **Step 4: Adicionar useEffect de cleanup no unmount**

Após o `useEffect` que chama `setRawTranscript(initialTranscript)`:

```ts
useEffect(() => {
  return () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
  }
}, [])
```

- [ ] **Step 5: Commit parcial**

```bash
git add src/components/steps/step-audio.tsx
git commit -m "feat(step-audio): add typewriter state and refs"
```

---

### Task 2: Implementar a lógica de animação

**Files:**
- Modify: `src/components/steps/step-audio.tsx`

- [ ] **Step 1: Adicionar a função `startTypewriter`**

Após `handleReset`, antes de `handleProcess`, adicionar:

```ts
function startTypewriter() {
  if (intervalRef.current) return
  intervalRef.current = setInterval(() => {
    const word = wordQueueRef.current.shift()
    if (word === undefined) {
      clearInterval(intervalRef.current!)
      intervalRef.current = null
      return
    }
    setDisplayedText((prev) => (prev ? prev + ' ' + word : word))
  }, TYPEWRITER_INTERVAL_MS)
}
```

- [ ] **Step 2: Integrar na leitura do stream dentro de `handleProcess`**

Substituir o trecho atual:

```ts
const clean = text.replace('__DONE__', '').replace(/\n$/, '')
if (clean) {
  full += (full ? ' ' : '') + clean
  setPartialTranscript(full)
}
```

Por:

```ts
const clean = text.replace('__DONE__', '').replace(/\n$/, '').trim()
if (clean) {
  full += (full ? ' ' : '') + clean
  setPartialTranscript(full)
  const allWords = full.split(' ')
  const newWords = allWords.slice(lastWordCountRef.current)
  lastWordCountRef.current = allWords.length
  wordQueueRef.current.push(...newWords)
  startTypewriter()
}
```

- [ ] **Step 3: Limpar a fila em caso de erro**

No bloco `catch`, antes de `setAudioState('idle')`, adicionar:

```ts
wordQueueRef.current = []
if (intervalRef.current) {
  clearInterval(intervalRef.current)
  intervalRef.current = null
}
setDisplayedText('')
lastWordCountRef.current = 0
```

- [ ] **Step 4: Resetar animação em `handleReset`**

Dentro de `handleReset`, após `setPartialTranscript('')`:

```ts
wordQueueRef.current = []
if (intervalRef.current) {
  clearInterval(intervalRef.current)
  intervalRef.current = null
}
setDisplayedText('')
lastWordCountRef.current = 0
```

- [ ] **Step 5: Commit**

```bash
git add src/components/steps/step-audio.tsx
git commit -m "feat(step-audio): implement word-by-word typewriter animation"
```

---

### Task 3: Conectar `displayedText` ao JSX e verificar

**Files:**
- Modify: `src/components/steps/step-audio.tsx`

- [ ] **Step 1: Trocar value do Textarea**

Localizar:

```tsx
value={partialTranscript}
```

Substituir por:

```tsx
value={displayedText}
```

- [ ] **Step 2: Rodar os testes existentes via context-mode**

Usar `ctx_execute(language: "shell", code: "cd d:/REPOS-GITHUB-PARTICULAR/project-anamnese-ia-claude-code-repo-local && npm test")` para confirmar que os 90 testes continuam passando.

Esperado: todos os testes passam (a mudança é só visual no componente).

- [ ] **Step 3: Verificação manual**

Abrir `/consultation/[id]`, ir ao Step 3 (Áudio), enviar um arquivo de áudio. Confirmar:
- Durante `streaming`: palavras aparecem uma a uma com ~30ms de intervalo
- Durante `done`: texto completo já visível (fila drenada)
- Retry (reset): campo limpa corretamente
- `initialTranscript` (restaurar sessão): texto aparece direto, sem animação

- [ ] **Step 4: Commit final**

```bash
git add src/components/steps/step-audio.tsx
git commit -m "feat(step-audio): show displayedText in textarea for typewriter effect"
```
