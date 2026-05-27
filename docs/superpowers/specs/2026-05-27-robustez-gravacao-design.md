# Robustez da Gravação — Silêncio, Hibernação e Alucinação

**Data:** 2026-05-27
**Status:** Aprovado (brainstorming)

## Contexto e problema

Durante teste com cliente real, o laptop entrou em **hibernação** no meio de uma consulta (médico se afastou para aferir PA e peso). Ao voltar, a UI ainda exibia "Gravando...", mas:

1. Nada foi capturado durante a suspensão (track do microfone morta).
2. A transcrição final continha "boa noite e tchau" — frase **nunca dita** pelo paciente.

### Causa raiz

Duas falhas distintas, com sintomas que se cruzam:

- **Problema A — Alucinação do Whisper em silêncio.** O `whisper-large-v3` (via Groq) inventa texto ao receber trechos de silêncio/ruído baixo. Em pt-BR as alucinações típicas são "Tchau", "Obrigado", "Boa noite", "Legendas pela comunidade...". A chamada atual em `src/lib/transcribe-chunks.ts` não passa `temperature: 0` nem `prompt`, e não há tratamento de silêncio. Isso afeta **qualquer silêncio legítimo** (aferição de PA, ausculta), não só a hibernação.
- **Problema B — Sem resiliência à interrupção.** Não há Wake Lock; a tela apaga e o SO suspende livremente. Quando a track morre, o código não escuta `track.onended`, `recorder.onerror` nem `visibilitychange` — a UI segue mostrando "Gravando..." sem capturar nada (falsa sensação de gravação).

> **Nota de arquitetura:** não existe transcrição ao vivo. Nos dois modos (gravar / upload) o áudio é gravado inteiro em memória (`MediaRecorder` → `chunksRef`) e enviado ao Groq só no final. O "tempo real" é apenas o efeito máquina-de-escrever exibindo o resultado.

## Decisões (entrevista)

- Tratar **as duas frentes juntas** como pacote único de "robustez da gravação".
- Silêncio: **híbrido** — detecção automática (VAD) + botão "Pausar" manual preservado.
- Interrupção: **preservar e avisar** — para a gravação, preserva o trecho, mostra o motivo específico, e o médico escolhe continuar (anexar novo segmento) ou transcrever o que tem.
- Comunicação: **Wake Lock silencioso**; aviso só quando uma interrupção real for detectada, com o motivo ("suspensão", "microfone desconectado", "aba em segundo plano").
- Abordagem de silêncio: **A + C** (VAD nativo no cliente + endurecimento do Whisper). Servidor com ffmpeg (B) descartado por complexidade desproporcional.

## Arquitetura

Mudança concentrada em dois lugares, com lógica extraída em hooks/funções isoladas e testáveis (evita inchar `step-audio.tsx`, que já é grande).

| Arquivo | Responsabilidade única |
| --- | --- |
| `src/hooks/use-silence-detection.ts` | VAD: avisa entrada/saída de silêncio via callback. Não conhece gravação. |
| `src/hooks/use-wake-lock.ts` | Adquirir/liberar/re-adquirir Wake Lock. |
| `src/hooks/use-recording-interruption.ts` | Detectar track morta / `visibilitychange` e reportar o **motivo**. |
| `src/lib/hallucination-filter.ts` | Função pura: remove frases de alucinação isoladas. |
| `src/components/steps/step-audio.tsx` | Orquestra os hooks; multi-segmento; feedback visual. |
| `src/lib/transcribe-chunks.ts` | `temperature: 0` + `prompt` + aplicar filtro. |

## Comportamento detalhado

### VAD — auto-pausa por silêncio (Abordagem A)

- Volume medido em tempo real via Web Audio API (`AnalyserNode`) sobre a stream existente do `getUserMedia`. **Local, sem conta, sem custo, sem rede.**
- **Limiar:** ~5% da escala (conservador — não cortar fala baixa).
- **Tempo até auto-pausar:** silêncio contínuo por **2,5s** → `MediaRecorder.pause()` (o tempo pausado **não entra no arquivo**; container webm permanece válido).
- **Retomada:** voz acima do limiar → `resume()` imediato (sem delay).
- Só vigia **após** o countdown de 3s (margem inicial).
- Feedback visual distinto da pausa manual: *"⏸ Silêncio detectado — pausado automaticamente"*.
- Reusa o mecanismo pause/resume existente; convive com o botão manual (híbrido).
- **Não descarta** áudio gravado — apenas evita gravar o trecho mudo; gravação continua no mesmo arquivo, costurada de forma contínua.

### Wake Lock

- **Adquire** (`navigator.wakeLock.request('screen')`) quando a gravação começa (após countdown).
- **Libera** em: `onstop`, desmontagem do componente, e fim da transcrição.
- **Re-adquire** ao voltar de `visibilitychange` se a gravação seguir ativa.
- **Degradação graciosa:** navegador sem suporte → não quebra; rede de segurança da interrupção assume.

### Detecção de interrupção + multi-segmento (Abordagem "preservar e avisar")

Sinais e motivo exibido:

| Sinal | Motivo |
| --- | --- |
| `track.onended` + aba ficou oculta antes | "O computador entrou em suspensão" |
| `track.onended` sem aba oculta | "O microfone foi desconectado" |
| `visibilitychange` prolongado durante gravação | "O app ficou em segundo plano" |

Ao disparar:

1. Gravação para automaticamente; trecho capturado preservado como **segmento**.
2. Aviso claro com motivo + tempo preservado: *"A gravação foi interrompida porque o computador entrou em suspensão. O áudio até 04:32 foi preservado."*
3. Médico escolhe: **continuar gravando** (novo segmento, concatenado no envio) ou **transcrever o que tem**.

**Mudança estrutural:** `chunksRef` único → lista de segmentos (`segmentsRef: Blob[]`), concatenados num único `Blob` no envio.

### Endurecimento do Whisper + filtro (Abordagem C)

- `transcribe-chunks.ts`: adicionar `temperature: 0` e `prompt` ("Transcrição de consulta médica em português do Brasil.").
- `hallucination-filter.ts`: função pura que remove frases de alucinação conhecidas **somente quando isoladas** (segmento/linha só com elas). Conservadora — nunca remove "obrigado" no meio de fala real. É o único tratamento que protege também **arquivos de upload** (sem VAD).

## Estratégia de testes (TDD — RED → GREEN → REFACTOR)

| Peça | Tipo | Cobertura |
| --- | --- | --- |
| `hallucination-filter.ts` | Unitário | Remove frase isolada; preserva "obrigado" no meio; case-insensitive; texto vazio. |
| `transcribe-chunks.ts` | Unitário/Integração | Mock Groq: envia `temperature: 0` e `prompt`; aplica filtro no resultado. |
| `use-silence-detection` | Unitário | Mock `AnalyserNode`: `onSilence` após limiar; `onSpeech` ao voltar. |
| `use-wake-lock` | Unitário | Mock `navigator.wakeLock`: adquire no start, libera no stop/unmount, re-adquire no `visibilitychange`. |
| `use-recording-interruption` | Unitário | Simula `track.onended` + visibilidade → motivo correto. |
| `step-audio.tsx` | Integração (RTL) | Auto-pausa muda indicador; interrupção mostra aviso com motivo; multi-segmento concatena. |
| Fluxo gravação | E2E (Playwright) | Mock mídia/IA; interrupção exibe aviso e preserva trecho. Sinais observáveis, sem timers (anti-flaky). |

**Nota:** `wakeLock`, `AnalyserNode`, `MediaRecorder.pause` não existem no jsdom → mockar nos testes unitários dos hooks.

## Entregáveis de processo

- Atualizar `docs/architecture.md` com o fluxo de gravação revisado (VAD, Wake Lock, interrupção).
- Build-doc final: `build-docs/2026-05-27/2026-05-27-robustez-gravacao.md`.

## Fora de escopo (YAGNI)

- Trimming de silêncio no servidor (ffmpeg).
- VAD com modelo de IA (Silero/ONNX) — só se ruído de consultório virar problema real.
- Transcrição ao vivo (streaming de áudio durante a consulta).
