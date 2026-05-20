# Design: Integração Groq Whisper — Transcrição de Áudio

**Data:** 2026-04-04
**Escopo:** Implementar `POST /api/transcribe` com Groq Whisper + corrigir logo navegável no layout de atendimento

---

## Contexto

O fluxo de atendimento tem 5 steps. No step 3 (StepAudio), o usuário seleciona um arquivo de áudio (.mp3, .wav, .m4a, .ogg, ≤ 25MB) e clica em "Iniciar Processamento". O componente `StepAudio` já está implementado e chama `POST /api/transcribe` com `FormData { audio }`, esperando `{ transcript: string }` como resposta. A rota existe como stub com TODO. O áudio **nunca é armazenado** — fica em memória durante o processamento e é descartado. O transcript vai para o `ConsultationContext` (estado React local).

---

## Mudanças

### 1. Instalar `groq-sdk`

```
npm install groq-sdk
```

Pacote oficial da Groq, tipado, compatível com Node.js runtime do Next.js e da Vercel. A `GROQ_API_KEY` lida do `process.env` — presente em `.env.local` localmente e como env var no painel da Vercel em produção.

---

### 2. `POST /api/transcribe`

**Arquivo:** `src/app/api/transcribe/route.ts`

**Fluxo:**

1. `getServerUser()` → 401 se não autenticado
2. Extrai `audio` do FormData → 400 se ausente
3. Valida tamanho ≤ 25MB server-side → 400 se exceder
4. Chama `groq.audio.transcriptions.create({ file, model: 'whisper-large-v3', language: 'pt' })`
5. Retorna `{ transcript: string }` — 200
6. Erros do Groq: captura e retorna `{ error: string }` — 502

**Sem storage:** o `File` é usado apenas na chamada ao SDK e descartado.

---

### 3. Corrigir logo navegável no layout `(session)`

**Arquivo:** `src/app/(session)/layout.tsx` (ou onde o topbar mínimo está definido)

A logo está dentro de um `<Link href="/">`. Substituir por `<span>` ou `<div>` para remover navegabilidade — o usuário só pode sair pelo botão "Abandonar consulta".

---

## Testes

- `src/app/api/transcribe/route.test.ts` — `@vitest-environment node`
- Cenários: sem auth (401), sem arquivo (400), arquivo > 25MB (400), sucesso (200 com transcript), erro do Groq SDK (502)
- Mock do `groq-sdk` via `vi.hoisted` + `vi.mock`
- Mock de `getServerUser` via `vi.mock('@/server/services/session')`

---

## Fora do escopo

- `audio_attempts` tracking — será abordado em iteração futura
- Integração Groq LLM para anamnese estruturada (`/api/anamnesis`) — próximo spec
- Gravação de áudio direto no browser (microfone)
