# Build 2026-05-26 — Margem de espera para gravação de áudio

Documento vivo. Atualizar a cada alteração desta sessão.

## Contexto

Estudo de pós-graduação sobre transcrição de áudio aponta como boa prática introduzir uma margem de espera entre a solicitação de acesso ao microfone e o início efetivo da gravação. Motivos:

1. `navigator.mediaDevices.getUserMedia()` é assíncrono — o usuário pode levar segundos para clicar em "Permitir" no prompt do navegador.
2. Mesmo após permissão concedida, o microfone leva milissegundos para estabilizar — iniciar `MediaRecorder.start()` imediatamente pode perder o início da fala.
3. Sem feedback visual entre o clique em "Iniciar gravação" e o início real, o usuário pode começar a falar antes de estar realmente gravando.

## Diagnóstico do fluxo atual

Em [src/components/steps/step-audio.tsx](src/components/steps/step-audio.tsx#L123-L150) (`handleStartRecording`):

- `getUserMedia` é chamado no clique do botão, sem estado intermediário visual.
- Tão logo a Promise resolve, o `MediaRecorder` é criado, `recorder.start(1000)` é disparado e o timer começa — sem margem.
- `catch` é genérico: mostra a mesma mensagem para permissão negada, mic ausente ou erro de hardware.

## Alterações

### 1. Estados novos no `RecordState`
- **Arquivo:** [src/components/steps/step-audio.tsx](src/components/steps/step-audio.tsx)
- **Antes:** `'idle' | 'recording' | 'paused' | 'recorded'`
- **Depois:** `'idle' | 'requesting' | 'preparing' | 'recording' | 'paused' | 'recorded'`
  - `requesting`: aguardando resposta do `getUserMedia` (prompt do navegador).
  - `preparing`: permissão concedida, countdown 3→2→1 em execução; mic ainda não está gravando.

### 2. Feedback visual durante `getUserMedia`
- Botão "Iniciar gravação" some, substituído por bloco com spinner + texto **"Solicitando acesso ao microfone..."**.
- Cancela automaticamente em caso de erro (volta para `idle`).

### 3. Countdown 3..2..1 antes de iniciar gravação
- Após permissão concedida, UI exibe o número grande (3 → 2 → 1) com texto **"Prepare-se para gravar..."**.
- Implementado via `setInterval(1000)` controlado por ref para cleanup seguro.
- Constantes exportáveis para teste: `COUNTDOWN_SECONDS = 3`, `COUNTDOWN_INTERVAL_MS = 1000`.
- Só ao final do countdown:
  1. `MediaRecorder` é instanciado;
  2. `recorder.start(1000)` é chamado;
  3. `startTimer()` é disparado;
  4. estado vira `'recording'`.

### 4. Tratamento de erro tipado
- `DOMException.name === 'NotAllowedError'` → toast: **"Permissão negada. Habilite o microfone nas configurações do navegador."**
- `DOMException.name === 'NotFoundError'` → toast: **"Nenhum microfone detectado neste dispositivo."**
- Outros erros → toast genérico atual: **"Não foi possível acessar o microfone. Verifique as permissões."**
- Em qualquer erro, estado volta para `'idle'` (botão "Iniciar gravação" reaparece).

### 5. Cleanup
- Ref `countdownRef` adicionado e limpo no `useEffect` de unmount junto com `intervalRef` e `timerRef`.
- Cancelar countdown também libera a stream (caso usuário navegue para fora durante o preparo).

## TDD

Arquivo de testes: [src/components/steps/step-audio.test.tsx](src/components/steps/step-audio.test.tsx)

### Mudanças no setup
- `vi.useFakeTimers()` em `beforeEach`, `vi.useRealTimers()` em `afterEach`.
- Helper `startRecording` agora avança 3s de fake timers para atravessar o countdown.

### Testes novos
1. **Estado `requesting`** — após clicar "Iniciar gravação" e antes do `getUserMedia` resolver, exibe "Solicitando acesso ao microfone...".
2. **Estado `preparing`** — após permissão concedida, exibe countdown e **não** cria `MediaRecorder` antes do countdown terminar.
3. **Countdown decrementa** — exibe "3", depois "2", depois "1" ao longo de 3s.
4. **`MediaRecorder` só inicia após countdown** — `MockMediaRecorder.instances.length === 0` durante `preparing`, vira `1` após avançar 3s.
5. **Erro `NotAllowedError`** — toast com mensagem específica de permissão.
6. **Erro `NotFoundError`** — toast com mensagem específica de mic ausente.
7. **Volta ao estado `idle` após erro** — botão "Iniciar gravação" reaparece.

### Testes existentes
Todos os testes anteriores continuam válidos — o helper `startRecording` foi atualizado para avançar os 3s do countdown, mantendo o contrato dos asserts (MockMediaRecorder criado, botões Pausar/Finalizar visíveis, etc).
