# Layout do app autenticado — topbar full-width + conteúdo centralizado (final)

**Data:** 2026-06-02

## Contexto

Consolidação da iteração de largura/alinhamento do shell autenticado (app + console).
As entregas anteriores do dia capavam a topbar junto com o conteúdo (`max-w-5xl`),
o que fazia o avatar "flutuar" longe do canto e o conteúdo parecer descolado da
sidebar. Esta entrega define o padrão final, validado visualmente com o usuário.

## Decisão final

- **Topbar autenticada (user/admin): full-width**, sem cap de largura. Os controles
  (sino, tema, avatar) ficam no **canto** superior direito — padrão de dashboard.
  Capar a topbar fazia o avatar flutuar no meio em telas grandes (rejeitado).
- **Conteúdo (`<main>` do app/console): centralizado** (`mx-auto`) num bloco recuado
  de **1280px** (`max-w-7xl`), com folga simétrica nos dois lados. A borda direita do
  conteúdo fica **antes** da linha do avatar.
- **Atendimento:** segue `shell` (1536px), inalterado.
- **Navbar/topbar pública:** segue 1024px (alinha com as seções da landing).

## Tokens (3 tiers) — `src/lib/layout.ts`

| Token | Valor | Uso |
| --- | --- | --- |
| `content` | `max-w-7xl` (1280) | `<main>` app/console, centralizado e recuado |
| `shell` | `max-w-screen-2xl` (1536) | fluxo de atendimento |
| `marketing` | `max-w-5xl` (1024) | navbar/topbar pública |

## Arquivos

- `src/lib/layout.ts` — três tiers nomeados (`content`/`shell`/`marketing`).
- `src/app/(app)/app-layout-client.tsx` — `<main>` usa `content` + `mx-auto` +
  `px-4 md:px-6 lg:px-8`.
- `src/app/(admin)/console/admin-layout-client.tsx` — idem.
- `src/components/layout/topbar.tsx` — variante user/admin **full-width**
  (`px-4 md:px-6`); variante public usa `marketing`.
- `.claude/rules/responsiveness.md` — seção "Largura máxima de conteúdo" atualizada
  para os 3 tiers + o padrão "topbar full-width / conteúdo centralizado".

## TDD

- `src/components/layout/topbar.test.tsx` — assert: topbar autenticada é full-width
  (sem cap `max-w-screen-2xl`/`max-w-7xl` no inner). Verde.
- `consultation-page-flow.test.tsx` (atendimento) — inalterado, segue verde.

## Observação

Esta entrega supersede o approach intermediário de capar a topbar autenticada
(documentado em `2026-06-02-topbar-autenticada-max-width.md`). O valor de `content`
também subiu de 1024 → 1280 em relação a `2026-06-02-tokens-largura-maxima.md`.
