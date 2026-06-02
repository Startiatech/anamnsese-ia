# Padronização da largura máxima de conteúdo — tokens centralizados

**Data:** 2026-06-02

## Problema

Os tetos de largura (`max-w-*`) estavam espalhados como string literal solta pelos
shells: `max-w-5xl` (app, console, topbars) e `max-w-screen-2xl` (atendimento).
Magic numbers que tendem a divergir com o tempo — não havia fonte única.

## Solução

Centralizar num token único em `src/lib/layout.ts` (`LAYOUT_MAX_W`), com **dois tiers
intencionais** nomeados, e substituir os `max-w-*` soltos pelos tokens.

- `src/lib/layout.ts` (novo)
  - `LAYOUT_MAX_W.content` = `max-w-5xl` (1024px) — reading/form-centric.
  - `LAYOUT_MAX_W.shell` = `max-w-screen-2xl` (1536px) — wizard/atendimento.

### Por que não um valor único

1024px cortaria o conteúdo do atendimento, que já é `max-w-6xl` (1152px). Os dois
tiers são deliberados: leitura confortável vs. shell largo com sidebar + conteúdo.

## Arquivos ajustados (sem mudança visual)

- `src/app/(app)/app-layout-client.tsx` — `<main>` usa `LAYOUT_MAX_W.content`.
- `src/app/(admin)/console/admin-layout-client.tsx` — idem.
- `src/components/layout/topbar.tsx` — variantes public e user/admin usam `LAYOUT_MAX_W.content`.
- `src/app/(session)/app/consultation/[id]/consultation-page-flow.tsx` — header e corpo usam `LAYOUT_MAX_W.shell`.

Os tokens resolvem para os mesmos literais de antes, então o resultado visual é
idêntico — é puro DRY + intenção explícita.

## Documentação

- `.claude/rules/responsiveness.md` — nova seção "Largura máxima de conteúdo" com a
  tabela de tiers, regra de uso e o racional de não unificar.

## TDD / verificação

- As classes literais (`max-w-5xl`, `max-w-screen-2xl`) seguem presentes em runtime,
  então os testes de classe existentes continuam válidos:
  - `topbar.test.tsx` e `consultation-page-flow.test.tsx` — 15/15 verdes.
- O Tailwind JIT gera o CSS a partir das strings literais em `src/lib/layout.ts`.

## Notas

- Login/suspended (split-screen) e banners de alerta seguem full-bleed — intencional.
- Console **não** recebe teto menor — dívida lá é largura insuficiente (tabela→card).
