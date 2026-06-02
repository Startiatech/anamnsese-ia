# Tooltip nos sinos da topbar (user e master)

**Data:** 2026-06-02

## Objetivo

Adicionar tooltip (shadcn/Radix) ao ícone de notificação da barra de navegação
superior, nos ambientes **user** e **master/admin**.

## Alterações

- `src/components/layout/notification-bell.tsx`
  - Botão do sino envolvido em `TooltipProvider` + `Tooltip`/`TooltipTrigger`/`TooltipContent`.
  - Label do tooltip: **"Notificações"**.
  - Tooltip suprimido enquanto o dropdown está aberto (`open ? false : undefined`)
    para não competir com a lista de notificações.
  - Componente é compartilhado entre user e admin (renderizado no `topbar.tsx` para
    ambas as variantes), então o tooltip cobre os dois lados de uma vez.
- `src/components/layout/topbar.tsx`
  - `PendingBell` (sino exclusivo do master, link de solicitações pendentes) também
    recebeu tooltip com label **"Solicitações pendentes"**, para consistência.

## TDD

1. RED → teste do tooltip "Notificações" ao focar o sino falhando.
2. GREEN → wrap do botão em Tooltip.
3. Resultado: `notification-bell` 12/12 verdes.

## Tap targets (review @responsive-reviewer)

- Sinos passaram de `w-8 h-8` (32px) para `h-10 w-10 md:h-8 md:w-8`: **40px no mobile**,
  voltando a 32px em `md+` (desktop, onde o mouse é preciso).
- Aplicado tanto no `NotificationBell` quanto no `PendingBell` (ação crítica do master
  no celular).

## Notas

- O `@responsive-reviewer` sugeriu remover os tooltips por serem hover-only no toque.
  **Decisão (alinhada ao usuário):** manter os tooltips — são o comportamento desejado
  no desktop e o `aria-label` + header do painel preservam a acessibilidade no toque,
  mesmo padrão já adotado no footer e no theme-toggle. O tooltip do sino é suprimido
  com o dropdown aberto, evitando competição visual.
- `topbar.tsx` não possui suíte de testes unitários; a mudança do `PendingBell` é
  puramente apresentacional e validada visualmente.
