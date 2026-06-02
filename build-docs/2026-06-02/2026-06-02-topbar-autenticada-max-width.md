# Topbar autenticada (user + admin) — alinha controles com o conteúdo capado

**Data:** 2026-06-02

## Problema

A topbar autenticada (variante `user`/`admin` em `src/components/layout/topbar.tsx`)
usava o inner full-bleed (`flex ... px-3 md:px-4` + spacer), então em telas grandes
os controles da direita (CreditsChip, NotificationBell, ThemeToggle, avatar) colavam
na borda direita extrema — enquanto o `<main>` abaixo é capado em `max-w-5xl mx-auto`
(tanto no app user quanto no console admin). Resultado: controles no extremo direito,
conteúdo centralizado/recuado logo abaixo → desalinhamento (mesmo sintoma já corrigido
na página de atendimento).

## Solução

Envolver o inner da topbar com o **mesmo cap do `<main>`**: `mx-auto w-full max-w-5xl`.
Topbar e `<main>` são irmãos dentro do `SidebarInset`, então compartilham o offset da
sidebar e a origem horizontal — o cap fica idêntico e os controles passam a alinhar com
a borda direita do conteúdo.

- `src/components/layout/topbar.tsx` (variante user/admin)
  - `<div className="h-full mx-auto w-full max-w-5xl flex items-center gap-2 px-3 md:gap-3 md:px-4">`
  - A variante `public` já usava `max-w-5xl` — agora user/admin ficam consistentes.

## Comportamento por viewport

- **1280/1920:** controles alinham com o conteúdo do `<main>` em vez de colar na borda.
- **≤768:** `max-w-5xl` (~1024px) não restringe; `w-full` domina → layout idêntico ao
  anterior. Sem overflow, hambúrguer/avatar intactos.

## TDD

1. RED → teste do container central (`max-w-5xl` + `mx-auto` dentro do `role="banner"`)
   falhando. Render mínimo: `variant="user"` + `isOnboarding` (evita SidebarTrigger e
   NotificationBell); mock de `@/server/actions/notifications` e de `matchMedia`.
2. GREEN → cap aplicado.
3. Resultado: `topbar.test.tsx` (novo) — 1/1 verde.

## Notas

- Diferença de padding mobile (`px-3` topbar vs `px-4` main) é irrelevante: o cap só
  atua acima de ~1024px, onde ambos usam `px-4`.
- Console **não** deve receber teto menor — sua dívida é largura insuficiente para
  tabelas densas (tabela→card), não excesso.
- Banners (Deletion/PinTemp) seguem full-bleed por serem alertas — intencional.
