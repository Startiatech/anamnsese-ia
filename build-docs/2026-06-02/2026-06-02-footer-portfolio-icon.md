# Ícone de portfólio no footer da landing page

**Data:** 2026-06-02

## Objetivo

Adicionar, no footer da landing page, um ícone que leva ao portfólio pessoal,
posicionado **antes** do ícone do LinkedIn.

URL: https://leonardo-santos-portfolio.vercel.app/

## Alterações

- `src/components/landing/landing-footer.tsx`
  - Novo componente `PortfolioIcon` (SVG de maleta/portfólio, stroke `currentColor`).
  - Novo link âncora antes do LinkedIn, com `target="_blank"`, `rel="noopener noreferrer"`,
    `aria-label="Portfólio"` e as mesmas classes de estilo dos demais ícones sociais.
- `src/components/landing/landing-footer.test.tsx` (novo)
  - Valida href/target/rel do link de portfólio.
  - Valida que o portfólio aparece antes do LinkedIn na DOM.
  - Garante que LinkedIn e WhatsApp continuam presentes.

## TDD

1. RED → teste do portfólio falhando (link inexistente).
2. GREEN → implementação mínima do ícone + âncora.
3. Resultado: 3/3 testes verdes (`vitest run src/components/landing/landing-footer.test.tsx`).

## Notas

- Mantém o padrão de cores/tokens do design system (sem hex hardcoded).
- Ordem final dos ícones: Portfólio → LinkedIn → WhatsApp.

---

## Atualização — tooltips nos ícones (mesma data)

### Objetivo

Trocar o `title` (tooltip nativo do browser) do `ThemeToggle` por um tooltip
shadcn/Radix e adicionar tooltips nos ícones de Portfólio, LinkedIn e WhatsApp do footer.

### Alterações

- `src/components/ui/theme-toggle.tsx`
  - Removido o atributo `title`.
  - Botão agora envolvido em `TooltipProvider` + `Tooltip`/`TooltipTrigger`/`TooltipContent`.
  - Quando `showLabel` é `true` (texto inline já visível), não envolve em tooltip.
- `src/components/landing/landing-footer.tsx`
  - Novo helper `SocialLink` (href + label + ícone) que renderiza o link dentro de
    `Tooltip`. Os três ícones agrupados sob um único `TooltipProvider`.
- `src/components/ui/theme-toggle.test.tsx` (novo)
  - Sem `title`; tooltip ao focar; `aria-label` preservado; `showLabel` sem tooltip.
  - Mock de `window.matchMedia` (exigido por `next-themes`).
- `src/components/landing/landing-footer.test.tsx`
  - Novos testes: links sem `title`; tooltip aparece ao focar cada ícone.

### TDD

1. RED → testes de tooltip/ausência de `title` falhando.
2. GREEN → conversão para Tooltip + helper `SocialLink`.
3. Resultado: footer 5/5 e theme-toggle 4/4 verdes.

### Ajuste de tap target (mesma data)

- `src/components/ui/theme-toggle.tsx`
  - Modo ícone (`!showLabel`) passou de `w-8 h-8` (32px) para `h-10 w-10` (40px),
    atendendo o mínimo de toque do padrão de responsividade.
  - Placeholder pré-mount ajustado para `w-10 h-10` (evita layout shift).
- `src/components/landing/landing-footer.tsx`
  - `SocialLink` com `min-h-[40px] min-w-[40px]` + `inline-flex` centralizado.
- Teste adicional em `theme-toggle.test.tsx`: modo ícone com alvo ≥40px. theme-toggle 5/5.
