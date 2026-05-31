# Consistência de cores entre temas — plano de execução

Data: 2026-05-31
Branch: `melhorando-ui-gravacao`

Plano para eliminar a inconsistência de cores entre **light** e **dark**, com foco no
"neon vazando no light". A fundação de tokens (`globals.css`) já está madura e correta —
o problema está na **camada decorativa hardcoded** que nasceu no tempo do dark-only e
nunca foi migrada para tokens.

> **Execução página por página.** A cada etapa, o assistente avisa qual arquivo vai
> alterar **antes** de mexer, para o usuário acompanhar. Nada de alteração em lote.

---

## Diagnóstico (resumo)

Duas camadas evoluíram em ritmos diferentes:

1. **Tokens** (`globals.css`) — light/dark completos, neutralizados. Está bom.
2. **Decoração hardcoded** (`rgba()`, `shadow-[0_0_...]`, gradientes `#8B5CF6→#06B6D4`)
   — idêntica nos dois temas; no dark vira neon (ok), no light fica borrão lavado (ruim).

A regra [.claude/rules/ui.md](../../.claude/rules/ui.md) ainda diz "Dark-only" e
"proibido `rgba()` hardcoded" — desatualizada e violada justamente nestes pontos.

---

## Decisões de escopo (acordadas com o usuário)

| Tema | Decisão |
| --- | --- |
| **Gradiente da marca** | Unificar tudo em `var(--gradient-brand)` = **azul→cyan**. Remover os inline roxo→cyan (`#8B5CF6→#06B6D4`), roxo→cyan escuro (`#7C3AED→#0891B2`) e violeta→cyan claro (`#A78BFA→#22D3EE`). O token já é azul→cyan, então é só apontar para ele. |
| **Glow/neon difuso** (sombras `0 0 Xpx`, blobs de fundo) | **Neutralizar/zerar no light**, **manter no dark**. Feito via token de glow com par light/dark (mesmo padrão de `--demo-card-shadow`). |
| **Visual dark** | **Preservado** — nada de regressão no que já está bom. |
| **Acentos violeta soltos** (`bg-violet-*`, `text-violet-*`, `hover:border-violet-*`) | Decisão **por página**, avaliada junto com o usuário durante a execução. Não migrar em massa. |
| **Fundo dark `#1B1C1E`** | Confirmado correto pelo usuário — não tocar. |

---

## Fase 0 — Tokens base (`globals.css`)

Pré-requisito de todas as outras fases. Adicionar tokens de glow com par light/dark:

```css
/* :root (light) — glow neutralizado (sem neon) */
--glow-brand:        none;                       /* ou sombra neutra suave, a definir */
--glow-accent-rose:  none;
--glow-accent-cyan:  none;
--glow-accent-violet:none;
--glow-accent-amber: none;
--glow-accent-emerald: none;

/* .dark — glow neon preservado */
--glow-brand:        0 0 12px rgba(124,58,237,0.35);
--glow-accent-...:   0 0 16px rgba(...,0.X);
```

- Confirmar que `--gradient-brand` permanece azul→cyan (já está: [globals.css:86](../../src/app/globals.css#L86) / [:162](../../src/app/globals.css#L162)).
- **Não** migra nenhum componente ainda — só cria a infraestrutura.
- Sem mudança visual perceptível até as fases seguintes.

---

## Fases seguintes — migração página por página (ordem por impacto no light)

Cada fase: avisar → alterar → usuário confere → seguir.

### Fase 1 — App: botões neon mais visíveis
- [src/components/plans/plan-card.tsx](../../src/components/plans/plan-card.tsx) (L124) —
  `shadow-[0_0_12px_rgba(124,58,237,0.35)]` → `shadow-[var(--glow-brand)]`.
- [src/app/(app)/app/settings/onboarding-checklist.tsx](../../src/app/(app)/app/settings/onboarding-checklist.tsx) (L36-37) —
  `shadow-[0_0_20px_rgba(124,58,237,0.35)]` → token; `background` já usa `var(--gradient-brand)` (ok).

### Fase 2 — Auth / login
- [src/app/(auth)/login/login-client.tsx](../../src/app/(auth)/login/login-client.tsx) —
  `FEATURES` glow/border `rgba()` (L80-83), ambient glows (L99-100). Texto já é theme-aware;
  alinhar o glow ao tema.

### Fase 3 — Páginas de estado (404 / suspenso)
- [src/app/not-found.tsx](../../src/app/not-found.tsx) (L17, 35, 70) — radial-gradient + drop-shadow
  fixos; gradiente do botão `#7C3AED→#0891B2` → `var(--gradient-brand)`.
- [src/app/suspended/page.tsx](../../src/app/suspended/page.tsx) — `TIPS` glow (L14-31), ambient
  (L44-45), `rgba(255,255,255,...)` (L53,147), gradientes `#A78BFA→#22D3EE` (L65,138) → token.

### Fase 4 — Landing page
- [src/components/landing/hero-section.tsx](../../src/components/landing/hero-section.tsx) (L30-32) — ambient blobs.
- [src/components/landing/benefits-section.tsx](../../src/components/landing/benefits-section.tsx) (L28,32,48-83) — glow inset/box.
- [src/components/landing/how-it-works.tsx](../../src/components/landing/how-it-works.tsx) (L83,92,97) — box-shadows.
- [src/components/landing/plans-section.tsx](../../src/components/landing/plans-section.tsx) (L48, 119, 132, 138) — ambient + gradientes `#8B5CF6→#06B6D4` → token.
- [src/components/landing/cta-section.tsx](../../src/components/landing/cta-section.tsx) (L13) — ambient.
- [src/components/landing/demo-widget.tsx](../../src/components/landing/demo-widget.tsx) (L131) — gradiente da barra → token (L200 já é `dark:block`, ok).

### Fase 5 — Console (admin)
- [src/components/console/resource-card.tsx](../../src/components/console/resource-card.tsx) (L20, 30) —
  `background: glow` por prop + gradiente `oklch` roxo/cyan hardcoded na barra → token.

---

## Fora de escopo (registrado, não será feito agora)

- Repintar todos os acentos violeta para azul (a "marca dividida"). Mantido roxo decorativo
  por decisão do usuário; só o **gradiente** vira azul→cyan.
- Atualizar [.claude/rules/ui.md](../../.claude/rules/ui.md) (remover "Dark-only"): fazer ao final,
  em commit próprio, depois que a migração validar o padrão de tokens de glow.

---

## Validação

- `pnpm run test:all` ao final de cada fase relevante (sem rodar build).
- Conferência visual light **e** dark pelo usuário a cada página.
- Sem mudança de comportamento/lógica — apenas apresentação visual.

---

## Status de execução

- [ ] Fase 0 — tokens base
- [ ] Fase 1 — plan-card + onboarding-checklist
- [ ] Fase 2 — login
- [ ] Fase 3 — 404 + suspenso
- [ ] Fase 4 — landing (hero, benefits, how-it-works, plans, cta, demo)
- [ ] Fase 5 — console resource-card
