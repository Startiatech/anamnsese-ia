# Spec: Typewriter Effect na Transcrição de Áudio

**Data:** 2026-04-05  
**Escopo:** `src/components/steps/step-audio.tsx` apenas  
**Motivação:** O texto da transcrição aparece em blocos abruptos; animar palavra por palavra melhora a percepção de progresso.

---

## Problema

O Groq Whisper processa áudio por segmentos e retorna cada segmento como um bloco de texto. O cliente já lê o stream progressivamente, mas chama `setPartialTranscript(full)` imediatamente, fazendo o texto "pular" de uma vez a cada chunk recebido.

---

## Solução

Introduzir uma camada de animação no `StepAudio`: palavras novas entram numa fila e são exibidas uma a uma via `setInterval`, dando efeito de digitação ao usuário.

---

## Arquitetura

### Novos estados/refs (apenas em `step-audio.tsx`)

| Nome | Tipo | Papel |
|---|---|---|
| `displayedText` | `useState<string>` | Texto animado exibido no `<Textarea>` |
| `wordQueueRef` | `useRef<string[]>` | Fila de palavras aguardando exibição |
| `intervalRef` | `useRef<ReturnType<typeof setInterval> \| null>` | Handle do interval ativo |
| `lastFullRef` | `useRef<string>` | Último `full` recebido, para calcular diff de palavras novas |

### Constante

```ts
const TYPEWRITER_INTERVAL_MS = 30 // ~33 palavras/segundo
```

### Fluxo de animação

```
chunk chega (full atualiza)
  → diff: newWords = full.split(' ').slice(lastFullRef words count)
  → wordQueueRef.current.push(...newWords)
  → se interval não ativo: startInterval()

setInterval a 30ms:
  → dequeue uma palavra
  → setDisplayedText(prev => prev + (prev ? ' ' : '') + word)
  → se fila vazia: clearInterval, intervalRef = null
```

### Estados especiais

- **`initialTranscript` presente** (restauração): `displayedText` inicializado diretamente com o valor, sem animação
- **Erro**: `wordQueueRef.current = []` + clearInterval + reset
- **`done` recebido**: nenhuma ação especial — fila drena naturalmente até esvaziar

### O que NÃO muda

- `partialTranscript` state continua acumulando o texto completo (fonte de verdade para `setRawTranscript`)
- JSX: apenas `value={partialTranscript}` → `value={displayedText}` no `<Textarea>`
- API `/api/transcribe` — sem alterações
- `useConsultation`, `ConsultationContext` — sem alterações
- Testes existentes — não afetados (testam a API, não o componente visual)

---

## Cleanup

`useEffect` de cleanup no unmount:
```ts
useEffect(() => {
  return () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
  }
}, [])
```

---

## Testes

- Não requer novos testes unitários (lógica trivial de UI/animação)
- Verificação manual: áudio curto (1 chunk) deve animar; áudio longo (N chunks) deve animar continuamente entre chunks

---

## Fora do escopo

- Velocidade configurável pelo usuário
- Pausa/play da animação
- Animação no estado `quota_exceeded` (texto já existente, não faz sentido animar)
