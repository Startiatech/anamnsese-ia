# Tabs padronizadas no azul — destaque do estado ativo e hover

**Data:** 2026-06-01

## Contexto

As tabs do projeto (componente único `UnderlineTabs`) indicavam a seleção apenas por
uma borda inferior (`border-primary`). O destaque era sutil demais — ao bater o olho
não ficava claro qual tab estava selecionada. Além disso o hover das tabs inativas usava
a cor neutra `accent` (cinza), destoando da identidade azul do projeto.

## Alterações

### 1. UX — `src/components/ui/underline-tabs.tsx`

Padronização de todos os estados no azul da marca (`--primary`), com hierarquia de
intensidade via `color-mix`:

| Estado | Fundo | Texto |
| --- | --- | --- |
| Inativa | transparente | `muted-foreground` |
| Inativa hover | azul 8% | azul (primary) |
| Selecionada | azul 12% + borda azul + cantos superiores arredondados | azul (primary) |
| Selecionada hover | azul 20% | azul (primary) |

Reflete nas 4 telas que consomem o componente: settings (user), settings (admin),
planos (admin) e feedbacks (admin).

**Detalhe técnico:** os modificadores de opacidade do Tailwind (`bg-primary/10`) não
funcionam neste projeto porque o `tailwind.config.ts` mapeia `primary` como `var(--primary)`
cru (um `oklch()`), sem o placeholder `<alpha-value>`. Por isso usamos
`color-mix(in oklch, var(--primary) N%, transparent)` — mesmo padrão já presente em
`globals.css`. Funciona em light e dark, pois `--primary` é redefinido em ambos os temas.

### 2. Padronização — remoção de código morto

- Removido `src/components/ui/tabs.tsx` (shadcn/Radix) — não tinha nenhum import no app;
  o projeto usa exclusivamente o `UnderlineTabs` customizado.
- Removida a dependência `@radix-ui/react-tabs` do `package.json` (só era usada pelo
  componente removido).

## Impacto

- Sem mudança de comportamento/lógica — apenas apresentação visual e limpeza.
- Um único componente de tab padronizado no produto.
