# Build 2026-05-27 — Robustez da Gravação de Áudio

Documento vivo. Atualizar a cada alteração desta sessão.

## Contexto

Durante uma consulta real, o notebook de um paciente entrou em modo de hibernação no meio da gravação. O microfone foi silenciado por um longo período de silêncio, e o Whisper (`groq/whisper-large-v3`) alucionou texto que nunca foi dito — entre as frases: **"boa noite e tchau"**. Além disso, a interface continuou exibindo "Gravando..." sem nenhum alerta ao médico, que só percebeu o problema ao tentar finalizar a consulta.

## Causa Raiz

**(A) Alucinação do Whisper em silêncio prolongado:** O modelo Whisper tende a gerar frases genéricas em pt-BR (saudações, agradecimentos, marcas de legenda) quando recebe áudio com silêncio ou ruído de baixo nível. Não havia filtragem dessas saídas.

**(B) Ausência de resiliência a interrupções de gravação:** Não havia detecção de encerramento de track do microfone nem de ocultação de aba. A UI ficava travada no estado "Gravando..." enquanto o `MediaRecorder` havia silenciado ou parado, sem feedback ao usuário e sem preservar o que já havia sido captado.

## Alterações

### 1. [src/lib/hallucination-filter.ts](src/lib/hallucination-filter.ts) — Causa A

Novo módulo puro. Exporta `filterHallucinations(text: string): string` e a lista `HALLUCINATION_PHRASES`. Remove frases conhecidas de alucinação do Whisper em pt-BR **somente quando isoladas** no chunk (regex `^\s*frase\s*$`), preservando menções legítimas no meio de texto.

Frases monitoradas incluem: `"tchau"`, `"obrigado"`, `"obrigada"`, `"boa noite"`, `"legendas pela comunidade amara.org"`, entre outras.

### 2. [src/lib/transcribe-chunks.ts](src/lib/transcribe-chunks.ts) — Causa A

Arquivo existente, modificado. Alterações:

- Adicionado `temperature: 0` na chamada ao Groq — reduz variabilidade e geração especulativa.
- Exportado `TRANSCRIPTION_PROMPT` (`"Transcrição de consulta médica em português do Brasil."`) — usado como `prompt` no Groq para ancorar o modelo ao domínio médico.
- `filterHallucinations` aplicado ao resultado de cada chunk antes de retornar a transcrição.
- Proteção válida tanto para o modo gravação quanto para upload direto de arquivo.

### 3. [src/hooks/use-silence-detection.ts](src/hooks/use-silence-detection.ts) — Causa B

Novo hook. Implementa VAD (Voice Activity Detection) via `Web Audio API` — nativo, sem biblioteca externa, sem custo, sem conta de terceiros.

- `AnalyserNode` calcula RMS do buffer de áudio a cada frame.
- Parâmetros exportados para teste: `SILENCE_THRESHOLD = 0.05` (5% de RMS máximo) e `SILENCE_MS = 2500` (2,5 s de silêncio contínuo).
- Callbacks: `onSilence()` ao atingir o limiar de silêncio; `onSpeech()` ao detectar retorno de fala.
- Cleanup automático (disconnect do nó) ao parar.

### 4. [src/hooks/use-wake-lock.ts](src/hooks/use-wake-lock.ts) — Causa B

Novo hook. Usa `navigator.wakeLock.request('screen')` para manter a tela ativa durante a gravação, evitando hibernação do dispositivo.

- Adquirido em `beginRecording`; liberado em `recorder.onstop`.
- Re-adquirido automaticamente em `visibilitychange` (caso o navegador libere o lock ao ocultar a aba).
- Degradação silenciosa quando `navigator.wakeLock` não é suportado (sem alerta ao usuário).

### 5. [src/hooks/use-recording-interruption.ts](src/hooks/use-recording-interruption.ts) — Causa B

Novo hook. Detecta encerramento inesperado da gravação.

- Escuta evento `'ended'` na track do microfone.
- Distingue a razão por um *watchdog* de clock-jump (gap entre ticks de `setInterval` muito maior que o esperado = event loop congelado = suspensão/hibernação). Substituiu a heurística de `document.hidden`, que falhava na hibernação real (o relógio avança enquanto o JS está congelado, tornando o evento "hidden" antigo demais).
- Exporta `INTERRUPTION_MESSAGES` (mapa de razão → mensagem em pt-BR) e tipo `InterruptionReason: 'suspended' | 'mic-disconnected'`.

### 6. [src/components/steps/step-audio.tsx](src/components/steps/step-audio.tsx) — Causas A e B

Arquivo existente, modificado. Orquestra os quatro hooks novos:

- **VAD auto-pause:** `onSilence` pausa o `MediaRecorder`; `onSpeech` retoma. Híbrido com a pausa manual existente — ambas coexistem com guards em `recorder.state`.
- **Wake Lock:** adquirido no início de `beginRecording`; liberado em `recorder.onstop`.
- **Interrupção:** ao disparar, chama `recorder.stop()` preservando o segmento atual. Exibe alerta (`data-testid="interruption-alert"`) com o motivo específico + "segmento preservado". Oferece dois caminhos: "Continuar gravando" (abre novo `getUserMedia` e anexa segmento) ou "Transcrever o que existe".
- **Multi-segmento:** introduzido `segmentsRef: Blob[]` que acumula todos os trechos gravados (gravação inicial + continuações pós-interrupção). Ao finalizar, os blobs são concatenados em um único `Blob` para upload. `segmentsRef` é limpo apenas em `handleReset`.

### 7. E2E — [e2e/specs/app/consultation.spec.ts](e2e/specs/app/consultation.spec.ts) e [e2e/fixtures/mocks.ts](e2e/fixtures/mocks.ts) — Causa B

- `mockMediaDevices` adicionado em `mocks.ts`: substitui `navigator.mediaDevices` com uma implementação controlada que permite disparar o evento `'ended'` na track via `page.evaluate`.
- Spec verifica que, após a track ser encerrada, o alerta de interrupção (`data-testid="interruption-alert"`) aparece com a mensagem correta.
- `playwright.config.ts` recebeu `launchOptions.args: ['--autoplay-policy=no-user-gesture-required']` no bloco `use` raiz para permitir o `AudioContext` nos testes headless.

## Decisões de Design

| Decisão | Motivo |
|---|---|
| VAD via Web Audio API nativa | Zero dependências, zero custo, funciona offline, sem conta de terceiro |
| Pausa híbrida (VAD + manual) | Médico mantém controle total; VAD é auxiliar, não sobrepõe ação humana |
| Preservar segmento em vez de descartar | Protege o trabalho já realizado; médico decide o próximo passo |
| Mensagem de interrupção com razão específica | Melhora diagnóstico: o médico sabe se foi hibernação, desconexão de mic ou aba em background |
| Wake Lock silencioso | Não distrai; só libera na parada — comportamento esperado sem necessidade de notificação |
| Filtro de alucinações só em frases isoladas | Evita falsos positivos — "obrigado" no meio de um texto clínico real não deve ser removido |
| `temperature: 0` + prompt de domínio | Reduz geração especulativa do Whisper; proteção ativa também no modo upload |

## TDD / Cobertura de Testes

Todos os testes abaixo foram validados em execução individual (`pnpm test <arquivo>`):

| Arquivo | Testes | Foco |
|---|---|---|
| `src/lib/hallucination-filter.test.ts` | 6 | filtragem isolada vs. em contexto, lista de frases |
| `src/lib/transcribe-chunks.test.ts` | 11 | temperature 0, prompt, filtro aplicado por chunk |
| `src/hooks/use-silence-detection.test.ts` | 4 | RMS abaixo/acima do limiar, callbacks, cleanup |
| `src/hooks/use-wake-lock.test.ts` | 5 | acquire, release, re-acquire em visibilitychange, degradação |
| `src/hooks/use-recording-interruption.test.ts` | 4 | razões de interrupção, janela de 4s, INTERRUPTION_MESSAGES |
| `src/components/steps/step-audio.test.tsx` | 36 | fluxo completo: VAD auto-pause, interrupção, multi-segmento, guards de estado |

## Pendências / Observações

- **E2E não foi executado neste ambiente.** Para validar: `pnpm test:e2e e2e/specs/app/consultation.spec.ts` (requer dev server + banco de teste + browsers Playwright instalados).
- Verificar se `--autoplay-policy=no-user-gesture-required` funciona corretamente no runner headless do CI antes de ativar o job E2E.
- O `navigator.wakeLock` não é suportado em Firefox e Safari Desktop — degradação silenciosa já implementada, mas vale documentar no onboarding se necessário.
