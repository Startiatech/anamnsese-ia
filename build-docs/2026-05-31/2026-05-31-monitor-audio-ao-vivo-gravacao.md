# Monitor de áudio ao vivo na gravação

**Data:** 2026-05-31
**Branch:** `melhorando-ui-gravacao`
**Spec:** `docs/superpowers/specs/2026-05-31-monitor-audio-ao-vivo-gravacao-design.md`
**Plano:** `docs/superpowers/plans/2026-05-31-monitor-audio-ao-vivo-gravacao.md`

---

## Objetivo

Dar feedback visual em tempo real de que o microfone está captando a voz durante a gravação da consulta — uma onda sonora ao vivo + um aviso discreto de microfone baixo. Antes, a tela de gravação mostrava apenas o temporizador, que conta mesmo com o microfone mudo. A camada é **puramente visual**, sobreposta ao fluxo existente, sem alterar nada da gravação, VAD, interrupção, segmentos ou transcrição.

## Decisões de produto (registradas na conversa de brainstorming)

- **Transcrição ao vivo foi descartada.** Avaliada a fundo: transcrever durante a gravação exigiria enviar áudio para a IA antes da confirmação (quebra de privacidade) ou usar um modelo local de qualidade inferior. O custo extra de IA + risco de degradar a qualidade atual não compensaram. A transcrição via Groq/Whisper continua acontecendo **só no clique manual final**.
- **Controle de volume do microfone do SO foi descartado** (impossível via navegador). Em vez de controlar, a feature **detecta e avisa** quando o volume está baixo.
- **Diarização (separar falas médico × paciente) descartada** como "nice-to-have" — inviável com microfone único de sala.

## O que foi entregue

### Arquivos novos
- `src/hooks/use-audio-level.ts` — hook que lê o volume (RMS 0..1) da mesma `MediaStream` do microfone via AudioContext/AnalyserNode e reporta via `onLevel`. Responsabilidade única: **medir** (não grava, não envia áudio). Ativo só com `recordState === 'recording'`. Degradação graciosa sem `AudioContext`.
- `src/hooks/use-audio-level.test.ts` — 6 testes (silêncio, sinal, inativo, stream null, sem AudioContext, cleanup).
- `src/components/steps/audio-waveform.tsx` — componente `<AudioWaveform>` que desenha a onda num `<canvas>` a partir de `level` + `variant` (`recording` | `silence` | `paused`). Apresentação pura; correção HiDPI; degradação graciosa quando o contexto 2D é nulo.
- `src/components/steps/audio-waveform.test.tsx` — 7 testes (label, variants, canvas nulo, w-full, cleanup do rAF).

### Arquivos alterados
- `src/components/steps/step-audio.tsx` — integra `useAudioLevel` + `<AudioWaveform>` nos blocos `recording` e `paused`; deriva `waveformVariant` de `recordState`/`autoPaused`; aviso de mic baixo (`role="status"`, `aria-live="polite"`) quando o nível fica entre 0.05 e 0.12 por ~3s contínuos; reset do aviso em `onstop` e `handleReset`.
- `src/components/steps/step-audio.test.tsx` — mock de `useAudioLevel` + testes de integração da onda (estados) e do aviso (mostrar, sustentar, normalizar, oscilação, finalizar).
- `e2e/specs/app/consultation.spec.ts` — teste E2E (restrito ao viewport mobile 375px) que valida a onda visível ao gravar e ausência de scroll horizontal.
- `docs/architecture.md` — diagrama da etapa de gravação atualizado com `useAudioLevel`/`AudioWaveform`, deixando explícito que o caminho da onda é local e não alimenta a IA.

## Comportamento visual

| Estado | Onda |
| --- | --- |
| Gravando | onda viva, gradiente da marca (≈ `#8B5CF6 → #06B6D4`) |
| Silêncio (auto-pausa VAD) | linha achatada |
| Pausa manual | onda congelada/esmaecida (cinza) |

Aviso de mic baixo: texto âmbar discreto que aparece após volume baixo sustentado e some sozinho ao normalizar.

## O que NÃO mudou (rede de segurança)

VAD, auto-pausa por silêncio, interrupção, segmentos de áudio, transcrição no clique final e cota de envios — **intactos**. A onda e o aviso nunca são caminho crítico: se o `AudioContext`/`canvas` falhar, a gravação segue normal.

## Commits (em ordem)

| SHA | Descrição |
| --- | --- |
| `4787b19` / `c6007b9` | hook `useAudioLevel` + cobertura extra |
| `ec1f2df` / `eeae4e5` | componente `AudioWaveform` + token de cor, variantRef, HiDPI, cleanup |
| `bbe8a1a` / `34a7eec` | integração da onda no `step-audio` + escopo/variant derivado |
| `cb17723` / `654d4df` | aviso de mic baixo + acessibilidade e cobertura |
| `895fa3e` / `e073d19` | E2E mobile da onda + gate de viewport e asserções |
| `c068737` | atualização do `architecture.md` |
| `b4dec77` | constantes nomeadas de gradiente e ganho |

## Revisões

- Conformidade com spec + qualidade de código a cada task (subagentes).
- `@ui-reviewer`: aprovado com ressalvas (paridade de cor do gradiente endereçada com constantes nomeadas + comentário de exceção).
- `@responsive-reviewer`: aprovado (375/768/1280/1920, sem scroll horizontal; Minors opcionais de alvo de toque e ResizeObserver deixados como follow-up).
- `@e2e-playwright-reviewer`: aprovado com ressalvas (gate de viewport e asserções fortalecidas aplicados).

## Follow-ups opcionais (não bloqueantes)

- `ResizeObserver` no canvas para re-rasterizar em rotação de dispositivo durante a gravação.
- Aumentar a altura do alvo de toque dos botões Pausar/Finalizar no mobile (hoje `h-9`).
