# Monitor de áudio ao vivo na gravação — Design

**Data:** 2026-05-31
**Status:** Aprovado (aguardando revisão do spec)
**Escopo:** Camada visual de feedback de áudio ao vivo durante a etapa de gravação da consulta.

---

## 1. Objetivo

Dar ao médico **feedback visual em tempo real de que o microfone está captando a voz** durante a gravação ao vivo. Hoje, a tela de gravação mostra apenas bolinha 🔴 + temporizador + status de texto + botões. O temporizador conta o tempo mesmo que o microfone esteja mudo ou com volume baixo — não há nenhuma confirmação de que o áudio está de fato entrando.

A motivação de produto: durante o atendimento o médico fica longe da máquina (examinando o paciente, na maca) e olha a tela à distância. Ele precisa bater o olho e ter certeza de que "está captando", além de ser avisado caso o volume do microfone esteja baixo demais.

### Não-objetivos (decisões já tomadas na conversa)

- **Não** transcrever ao vivo. A transcrição via Groq/Whisper continua acontecendo **somente no clique final**, preservando a garantia de privacidade ("o áudio só sai após confirmação") e a qualidade atual.
- **Não** controlar o volume do microfone do sistema operacional do usuário (impossível via navegador — não existe API). A estratégia é **detectar e avisar**, não controlar.
- **Não** fazer diarização (separação de falas médico × paciente). Avaliado e descartado como "nice-to-have" — inviável com microfone único de sala e exigiria trocar de fornecedor.

---

## 2. Princípio de arquitetura

> A camada nova é **puramente visual, por cima do que já funciona**. Nada da lógica de gravação, VAD, auto-pausa, interrupção, segmentos, transcrição ou cota é alterado.

### Reuso do volume já calculado

O hook `useSilenceDetection` (`src/hooks/use-silence-detection.ts`) já mede o volume (RMS) da stream do microfone a cada 200ms via `AnalyserNode`, **mas descarta o valor** — usa apenas para decidir silêncio. A feature **expõe esse mesmo nível de volume** para alimentar a UI, em vez de criar um segundo `AnalyserNode` (desperdício de recurso e risco de divergir do VAD).

### Componentes

| Unidade | Responsabilidade | Depende de |
| --- | --- | --- |
| `useAudioLevel` (hook novo) | Ler a stream e expor o nível de volume atual (0..1) em tempo real. Responsabilidade única: medir nível. | `MediaStream`, Web Audio API |
| `<AudioWaveform>` (componente novo) | Desenhar a onda sonora num `<canvas>` a partir do nível + estado. Não sabe nada de gravação. | nível (prop), estado (prop) |
| `step-audio.tsx` (integração) | Renderizar `<AudioWaveform>` no lugar certo e passar nível + estado. | hook + componente |

**Decisão:** hook novo `useAudioLevel` separado, em vez de acoplar `onLevel` ao `useSilenceDetection`. Mantém responsabilidade única — o de silêncio decide silêncio; o de nível alimenta visual. Ambos leem a mesma `mediaStreamRef.current`.

> Nota de implementação: dois `AnalyserNode` na mesma stream é aceitável e barato (a stream é uma fonte; cada analyser só lê). Alternativa de otimização (um único analyser compartilhado) fica como melhoria futura se houver impacto medido — YAGNI por ora.

---

## 3. Comportamento visual

### Estados da onda

| Estado de gravação | Aparência da onda |
| --- | --- |
| `recording` (gravando) | Onda viva, animada com a voz. Cor: gradiente da marca violeta→ciano (`#8B5CF6 → #06B6D4`) via token CSS. |
| Silêncio detectado (VAD auto-pausou, `autoPaused`) | Linha achatada/reta — reforça visualmente o "⏸ Silêncio detectado" já existente. |
| `paused` (pausa manual) | Onda congelada e esmaecida (cinza) — deixa claro "você pausou de propósito". |

### Aviso de microfone baixo (discreto)

Quando há voz (nível acima do silêncio) **mas** o nível fica abaixo de um limiar "saudável" por alguns segundos contínuos, aparece um texto âmbar discreto:

> ⚠️ Volume do microfone baixo — aproxime-se ou aumente o volume nas configurações

- **Discreto:** aparece só enquanto o volume está baixo e **some sozinho** quando normaliza. Não bloqueia, não assusta.
- **Limiar proposto (a calibrar na implementação):** nível RMS entre o limiar de silêncio (`SILENCE_THRESHOLD = 0.05`, 5%) e ~`0.12` (12% da escala), sustentado por ~3s contínuos. O piso de 5% evita confundir silêncio (que já é tratado pelo VAD) com "mic baixo".

---

## 4. Layout

Faixa larga de onda **abaixo do status, acima dos botões Pausar/Finalizar**, ocupando a largura do bloco principal. Máxima visibilidade à distância, que é o objetivo de produto.

Tudo que existe hoje permanece na mesma posição: bolinha 🔴 + timer + status de texto + botões.

### Responsividade (requisito de primeira classe)

Segue `.claude/rules/responsiveness.md`. A onda e o aviso devem funcionar em **375 / 768 / 1280 / 1920**:

- Sem scroll horizontal em 375px — o `<canvas>` usa largura fluida (`w-full`), nunca largura fixa em px.
- O aviso de mic baixo quebra linha sem empurrar layout nem sobrepor texto em 375px.
- Os botões Pausar/Finalizar continuam acessíveis e com alvo de toque ≥40px no mobile; a onda não os empurra pra fora da viewport.
- Piso de 320px: não pode quebrar nem sobrepor.
- Revisar com o agente `@responsive-reviewer`.

---

## 5. Rede de segurança (degradação graciosa)

- VAD, auto-pausa, interrupção, segmentos, transcrição no final e cota permanecem **intactos**.
- Se o `AudioContext` não existir (`typeof AudioContext === 'undefined'`) ou o `<canvas>` falhar, a gravação continua funcionando normalmente — apenas sem a onda. Mesmo padrão de degradação que o `useSilenceDetection` já adota.
- A onda nunca é caminho crítico: é enfeite informativo. Falha nela não pode derrubar a gravação.

---

## 6. Testes (TDD)

- **`useAudioLevel`:** dado um stream mock, emite níveis de volume; respeita a flag `active` (não mede quando inativo); limpa o `AudioContext` no cleanup.
- **`<AudioWaveform>`:** renderiza corretamente cada estado (`recording` / silêncio / `paused`); mostra/esconde o aviso de mic baixo conforme o nível e a janela de tempo.
- **`step-audio`:** a onda aparece no estado `recording` e some fora dele; nenhuma regressão na lógica existente (gravar, pausar, auto-pausa, finalizar, transcrever, cota).
- Validar via `pnpm run test:all` (não rodar build automaticamente).

---

## 7. Arquivos afetados (previsão)

| Arquivo | Mudança |
| --- | --- |
| `src/hooks/use-audio-level.ts` | **Novo** — hook de nível de volume |
| `src/hooks/use-audio-level.test.ts` | **Novo** — testes do hook |
| `src/components/steps/audio-waveform.tsx` | **Novo** — componente da onda |
| `src/components/steps/audio-waveform.test.tsx` | **Novo** — testes do componente |
| `src/components/steps/step-audio.tsx` | Integração: renderizar a onda no layout; passar nível + estado |
| `docs/architecture.md` | Atualizar o diagrama da etapa de gravação/áudio |

---

## 8. Decisões registradas

1. Transcrição ao vivo descartada (custo + risco de degradar qualidade atual; quebra de privacidade).
2. Onda sonora (waveform) escolhida sobre barras de espectro e blob — vibe clínica/discreta.
3. Layout em faixa larga abaixo do status.
4. Aviso de mic baixo discreto e auto-some.
5. Hook de nível separado do hook de silêncio (responsabilidade única).
6. Responsividade é requisito, não opcional.
