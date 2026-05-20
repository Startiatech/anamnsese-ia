# Design: Streaming de Transcrição + Cota de Tentativas + Persistência

**Data:** 2026-04-04
**Escopo:** Streaming em tempo real da transcrição via ReadableStream, controle de cota de tentativas de áudio por plano, persistência temporária do transcript no banco e limpeza na finalização do atendimento.

---

## Contexto

O step 3 (StepAudio) hoje aguarda a transcrição completa e só então exibe o resultado. Vamos adicionar:
1. **Streaming** — o texto aparece numa textarea ao vivo enquanto cada chunk é processado
2. **Cota de tentativas** — cada plano define quantas tentativas de áudio o usuário tem por consulta (`f5.limit`). O `experimental` tem 2, o `profissional` é ilimitado.
3. **Persistência temporária** — o transcript é salvo no banco após cada transcrição bem-sucedida para não ser perdido em refresh. É removido quando o atendimento é finalizado (abandonado ou concluído) por privacidade.

---

## Mudanças no banco

### Migration 1: Adicionar campo `limit` ao `f5` em todos os planos

```sql
UPDATE plans SET features = (
  SELECT jsonb_agg(
    CASE
      WHEN f->>'id' = 'f5' THEN f || '{"limit": 2}'::jsonb
      ELSE f
    END
  )
  FROM jsonb_array_elements(features) AS f
) WHERE id = 'experimental';

UPDATE plans SET features = (
  SELECT jsonb_agg(
    CASE
      WHEN f->>'id' = 'f5' THEN f || '{"limit": null}'::jsonb
      ELSE f
    END
  )
  FROM jsonb_array_elements(features) AS f
) WHERE id = 'profissional';
```

`limit: number` = máximo de tentativas. `limit: null` = ilimitado.

Planos sem `f5` (profissional-premium, clinica-gestao) não precisam da migration — cota não se aplica.

---

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `src/server/repositories/plans.ts` | Adicionar `limit?: number \| null` ao tipo `PlanFeature` |
| `src/app/(session)/consultation/[id]/page.tsx` | Buscar `audio_attempts`, `f5.limit` e `raw_transcript` da consulta atual |
| `src/app/(session)/consultation/[id]/consultation-page-flow.tsx` | Passar novos props (`audioAttemptsUsed`, `audioAttemptsLimit`, `initialTranscript`) ao `StepAudio` |
| `src/context/consultation-context.tsx` | Aceitar `initialTranscript` no provider |
| `src/lib/transcribe-chunks.ts` | Adicionar callback `onChunk` |
| `src/app/api/transcribe/route.ts` | Streaming via `ReadableStream`, check de cota, incremento de `audio_attempts` + salvar `raw_transcript` ao concluir |
| `src/components/steps/step-audio.tsx` | Redesign completo: estados `idle` → `streaming` → `done`, exibição de cota, botão "Trocar áudio" |
| `src/server/actions/consultation.ts` | `abandonConsultation` limpa `raw_transcript: null`. Novo `saveTranscript` e `clearTranscript`. |

---

## 1. `src/server/repositories/plans.ts`

Adicionar `limit` ao tipo:

```ts
export interface PlanFeature {
  id: string
  label: string
  active: boolean
  limit?: number | null  // null = ilimitado, number = máximo de tentativas
}
```

---

## 2. `src/server/actions/consultation.ts`

### `abandonConsultation` — limpar `raw_transcript`

Trocar `raw_transcript: rawTranscript || null` por `raw_transcript: null` — o transcript não deve ser persistido após abandono.

### Novo: `saveTranscript(patientId, transcript)` — server action

Salva o transcript no banco após transcrição bem-sucedida e incrementa `audio_attempts`:

```ts
export async function saveTranscript(patientId: string, transcript: string): Promise<void> {
  const user = await getServerUser()
  if (!user) return
  await supabase
    .from('consultations')
    .update({
      raw_transcript: transcript,
      audio_attempts: supabase.rpc('increment_audio_attempts', { ... }),  // ver abaixo
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.sub)
    .eq('patient_id', patientId)
}
```

Na prática: usar um UPDATE com `audio_attempts = audio_attempts + 1` via SQL bruto (sem RPC separada):

```ts
export async function saveTranscript(patientId: string, transcript: string): Promise<void> {
  const user = await getServerUser()
  if (!user) return
  await supabase.rpc('save_transcript_and_increment', {
    p_user_id: user.sub,
    p_patient_id: patientId,
    p_transcript: transcript,
  })
}
```

### Migration 2: RPC `save_transcript_and_increment`

```sql
CREATE OR REPLACE FUNCTION save_transcript_and_increment(
  p_user_id uuid,
  p_patient_id uuid,
  p_transcript text
) RETURNS void LANGUAGE sql AS $$
  UPDATE consultations
  SET
    raw_transcript = p_transcript,
    audio_attempts = audio_attempts + 1,
    updated_at = now()
  WHERE user_id = p_user_id AND patient_id = p_patient_id;
$$;
```

### Novo: `clearTranscript(patientId)` — usado na conclusão do atendimento (step 5)

```ts
export async function clearTranscript(patientId: string): Promise<void> {
  const user = await getServerUser()
  if (!user) return
  await supabase
    .from('consultations')
    .update({ raw_transcript: null, updated_at: new Date().toISOString() })
    .eq('user_id', user.sub)
    .eq('patient_id', patientId)
}
```

---

## 3. `src/app/api/transcribe/route.ts`

### Nova interface

Recebe via FormData: `audio` (File) + `patientId` (string).

### Fluxo completo

1. Verifica JWT → 401
2. Extrai `audio` + `patientId` do FormData → 400 se ausentes
3. Busca `consultation.audio_attempts` + `plan.f5.limit` do banco
4. Se `limit !== null && audio_attempts >= limit` → 403 `{ error: 'Cota de tentativas esgotada.' }`
5. Retorna `Response` com `ReadableStream`
6. Para cada chunk: transcreve → envia texto via stream (`encoder.encode(text + '\n')`)
7. Ao final: chama `saveTranscript(patientId, fullTranscript)` via import direto do server action
8. Fecha o stream

### Formato do stream

Texto puro, um chunk por linha (`\n`). O cliente concatena os chunks recebidos.

Ao finalizar, envia um marcador especial: `__DONE__\n` para o cliente saber que o stream encerrou.

---

## 4. `src/lib/transcribe-chunks.ts`

Adicionar parâmetro `onChunk` opcional:

```ts
export async function transcribeInChunks(
  file: File,
  groq: Groq,
  onChunk?: (text: string) => void
): Promise<string> {
  // ...
  for (const chunk of chunks) {
    // ...
    transcripts.push(text)
    onChunk?.(text)  // notifica a cada chunk
  }
  return transcripts.join(' ')
}
```

A rota usa `onChunk` para escrever no ReadableStream conforme cada chunk chega.

---

## 5. `src/app/(session)/consultation/[id]/page.tsx`

Buscar adicionalmente:
- `consultation.audio_attempts` (current)
- `plan.f5.limit` (max, null = ilimitado)
- `consultation.raw_transcript` (para restaurar após refresh)

Passar novos props ao `ConsultationPageFlow`:

```ts
interface ConsultationPageProps {
  patient: Patient
  planFeatures: PlanFeatures  // já existente
  audioAttemptsUsed: number
  audioAttemptsLimit: number | null
  initialTranscript: string
}
```

---

## 6. `src/context/consultation-context.tsx`

`ConsultationProvider` aceita `initialTranscript?: string`:

```ts
export function ConsultationProvider({
  children,
  initialPatient,
  initialTranscript,
}: {
  children: ReactNode
  initialPatient?: Patient | null
  initialTranscript?: string
})
```

Usa `initialTranscript` para popular `rawTranscript` no estado inicial. Se `initialTranscript` não vazio, `step` inicial = 4 (pula direto para seleção de seções).

---

## 7. `src/components/steps/step-audio.tsx`

### Props recebidas

```ts
interface StepAudioProps {
  patientId: string
  audioAttemptsUsed: number
  audioAttemptsLimit: number | null  // null = ilimitado
}
```

### Estados internos

```ts
type AudioState = 'idle' | 'streaming' | 'done' | 'quota_exceeded'
```

### Comportamento por estado

**`idle`:**
- Seletor de arquivo (drag & drop + clique)
- Display de cota: `"Uso da cota: {used}/{limit}"` ou oculto se ilimitado
- Botão "Iniciar Processamento" (disabled sem arquivo)
- Se `audioAttemptsUsed >= limit && limit !== null` → estado `quota_exceeded` imediatamente

**`streaming`:**
- `<textarea readOnly>` preenchendo ao vivo com `partialTranscript`
- Cursor piscando (`animate-pulse`) após último caractere
- Toast "Aguarde..." ativo

**`done`:**
- `<textarea readOnly>` com transcript completo
- Botão "Continuar" (chama `nextStep()`)
- Botão "Trocar áudio" — visível somente se `audioAttemptsUsed < limit || limit === null`
  - Ao clicar: reseta estado local para `idle`, limpa `partialTranscript`
  - **Não** desconta cota — o próximo envio é que debita

**`quota_exceeded`:**
- Mensagem: `"Você utilizou todas as {limit} tentativas de envio disponíveis no seu plano."`
- Apenas botão "Continuar" se transcript já existe no contexto

### Leitura do stream

```ts
const response = await fetch('/api/transcribe', { method: 'POST', body: formData })
const reader = response.body!.getReader()
const decoder = new TextDecoder()
let full = ''

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  const chunk = decoder.decode(value)
  if (chunk.includes('__DONE__')) break
  full += chunk
  setPartialTranscript(full)
}

setRawTranscript(full)
setAudioState('done')
```

---

## Privacidade — limpeza do transcript

| Evento | Ação |
|---|---|
| Transcrição bem-sucedida | `raw_transcript` salvo no banco + `audio_attempts` incrementado |
| Abandono da consulta | `raw_transcript = null` (limpo para privacidade) |
| Conclusão do atendimento (step 5) | `clearTranscript()` chamado antes de marcar `status = completed` |
| Refresh da página | `raw_transcript` lido do banco → restaura transcript + avança para step 4 |

---

## Fora do escopo

- Retry automático de chunk com falha
- Overlap entre chunks
- Progresso por percentual (ex: "3 de 5 partes")
- Notificação push quando transcrição longa finaliza
