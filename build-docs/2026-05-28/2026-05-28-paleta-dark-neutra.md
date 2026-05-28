# Paleta dark neutra ancorada em #1B1C1E

Data: 2026-05-28
Branch: `development`

Troca da paleta de superfícies do tema **dark** de um charcoal levemente azulado
(hue 260, chroma ~0.025) para uma escala **neutra** (chroma 0) ancorada em `#1B1C1E`.
Só superfícies/chrome do `.dark` — texto, marca, light theme e alto contraste intactos.

## Motivação

Cor `#1B1C1E` (vista numa plataforma de estudo) aplicada como fundo. Para coesão, o matiz
azul foi removido das demais superfícies, que antes destoavam contra o fundo neutro.

## Escala (oklch, chroma 0 — degraus ~0.025 de elevação)

| Token | Novo | Antigo |
| --- | --- | --- |
| `--background` | `oklch(0.227 0 0)` (#1B1C1E) | `oklch(0.12 0.025 260)` |
| `--sidebar-background` | `oklch(0.248 0 0)` | `oklch(0.17 0.025 260)` |
| `--card` | `oklch(0.273 0 0)` (elevação +1) | `oklch(0.17 0.025 260)` |
| `--popover` | `oklch(0.30 0 0)` | `oklch(0.20 0.025 260)` |
| `--secondary` / `--muted` / `--accent` / `--input` / `--sidebar-accent` | `oklch(0.30 0 0)` | `oklch(0.28 0.030 260)` |
| `--topbar-scrolled-bg` | `oklch(0.227 0 0 / 0.92)` | `oklch(0.12 0.025 260 / 0.92)` |
| `--autofill-bg` | `oklch(0.227 0 0)` | `oklch(0.12 0.025 260)` |
| `--section-tray-bg` | gradiente `oklch(0.273 0 0)` | `oklch(0.17 0.025 260)` |
| `--section-cta-bg` | gradiente `oklch(0.195 0 0)` | `oklch(0.10 0.025 260)` |
| `--chart-4` | `oklch(0.35 0 0)` | `oklch(0.35 0.040 260)` |
| `--chart-5` | `oklch(0.28 0 0)` | `oklch(0.28 0.030 260)` |

## Decisões

- **`--card` subido** para `0.273` (acima do fundo `0.227`) para reforçar a sensação de
  elevação, já que o fundo neutro ficou mais claro que o antigo.
- **`--border`/`--ring` mantidos:** border é branco translúcido (já neutro); ring é o roxo
  da marca (proposital).
- **Texto mantém leve tom frio:** `--foreground` e `--muted-foreground` continuam com hue
  (são texto, não superfície) — leitura confortável e sem custo de coesão.
- **`--chart-1/2/3` mantidos** (azuis da marca); só 4/5 (neutros) foram alinhados ao fundo.
- **Alto contraste e light theme não tocados** — sem regressão de acessibilidade.

Arquivo: [src/app/globals.css](src/app/globals.css). Sem mudança de comportamento/teste.
