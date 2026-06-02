# Padronização de ícones para azul + componente IconBadge

**Data:** 2026-06-01
**Escopo:** ambiente user (`(app)/`) — padronização da cor dos badges de ícone para o azul do projeto.

## Contexto

Continuação da padronização de ícones para o azul do projeto. O usuário reportou que,
ao trocar os fundos dos badges de ícone para `bg-primary/<opacidade>`, o fundo do
quadradinho ficava invisível.

## Causa raiz

Projeto usa **Tailwind v3** e o token `primary` está definido em `tailwind.config.ts`
como `primary: { DEFAULT: 'var(--primary)' }` — **sem** o placeholder `<alpha-value>`.
Por isso modificadores de opacidade (`bg-primary/15`, `bg-primary/[0.08]`) **não geram
CSS válido** e o fundo não renderiza. `text-primary` (sem opacidade) funciona normal.

> Implicação: TODO `bg-primary/<opacidade>` espalhado no projeto renderiza invisível
> (ex.: header do `app-sheet`, cards de métrica do dashboard). Correção na raiz (ajustar
> o token para suportar `<alpha-value>`) foi **deferida** por blast radius alto — exige
> varredura visual ampla. Estratégia adotada: migração incremental usando paleta `blue`
> nativa do Tailwind, que suporta opacidade.

## Solução

Criado `src/components/ui/icon-badge.tsx` — referência única do badge de ícone:

- Paleta `blue` nativa (não o token `primary`), evitando o bug de opacidade.
- Variantes de cor: `blue` (default), `destructive`, `success`, `warning`.
- Variantes de tamanho: `sm` (32×32, ícone h-4), `md` (40×40, ícone h-5), `lg` (48×48, ícone h-6).

## Arquivos alterados

- `src/components/ui/icon-badge.tsx` — **novo** componente.
- `src/app/(app)/app/settings/tabs/tab-profile.tsx` — Pessoais, Dados CRM/CRP, Tempo médio → `IconBadge`.
- `src/app/(app)/app/settings/tabs/tab-clinic.tsx` — Identificação, Endereço, Info adicionais → `IconBadge`.
- `src/app/(app)/app/settings/tabs/tab-security.tsx` — Senha, PIN (blue) + Zona de Perigo (`color="destructive"`) → `IconBadge`.
- `src/app/(app)/app/settings/tabs/tab-accessibility.tsx` — `SectionCard` migrado (cobre todos os blocos).
- `src/app/(app)/app/settings/tabs/request-feedback-card.tsx` — "Falta algum ajuste?" → `IconBadge`.
- `src/app/(app)/app/plans/...` `plan-card.tsx` — plano experimental (ícone/badge/iconBg) e ícone "Visualizar recursos detalhados" → paleta blue.
- `src/components/ui/app-sheet.tsx` — wrapper do ícone do header: `bg-primary/15` → paleta blue (corrige fundo invisível em todos os sheets).
- `src/components/consultation/{edit-patient,last-anamnesis,new-patient}-sheet.tsx` — ícone `text-primary` → par blue.

## Rodada 2 — Dashboard + checkbox clínica

- `tab-clinic.tsx` — checkbox "Sou o Responsável Técnico": `accent-violet-500` → `accent-blue-500`.
- `metrics-row.tsx` — badges migrados para `IconBadge size="sm"` (removido `bgClass`/`iconClass`).
- `time-saved-card.tsx` — círculo do ícone `bg-primary/10` → paleta blue.
- `recent-activity.tsx` — bolinha de timeline `bg-primary/10` + dot `bg-primary` → paleta blue.
- `weekly-chart.tsx` — barras `bg-primary`/`bg-primary/30` (dias não-atuais invisíveis) → `bg-blue-500`/`/30`; label do dia → par blue.
- `credit-widget.tsx` — **mantido**: cores semânticas de estado (vermelho/âmbar/esmeralda) por saldo, intencionais e renderizam ok.

## Rodada 3 — Console admin

- `icon-badge.tsx` — adicionada variante de tamanho `lg` (48×48, ícone h-6).
- `console-dashboard-client.tsx` — badge "Profissionais cadastrados" (`lg`) e cards de métrica (`sm`) → `IconBadge`; bolinha da lista de profissionais (`w-7`) → paleta blue inline.
- `feedbacks-client.tsx` — badges de métrica → `IconBadge size="sm"`.
- `plans-client.tsx` — pill `bg-primary/10` (invisível) do nome do plano → paleta blue.
- **Acentos violeta → azul** (resquícios da identidade violeta antiga): pill de plano em `interesses-client`, texto/total "Consumo Groq" em `edit-user-modal`, caixa do PIN em `reset-pin-modal`.
- **Mantidos (corretos):** estados de aba ativa `bg-primary text-primary-foreground` (sólidos, renderizam).

## Rodada 4 — Modais do dashboard

- `no-credits-modal.tsx` — moldura do ícone `rgba(124,58,237,...)` (violeta) → `bg-blue-500/15 border-blue-500/30` (classes Tailwind, sem rgba hardcoded); glow inline mantido. Gradiente radial vermelho de alerta mantido (intencional). SVG já era azul→cyan.
- `welcome-modal.tsx` — header badge violeta → azul; borda do modal `border-primary/25` (invisível) → `border-blue-500/25`. Lista de 5 passos mantida multicolor (codificação proposital por etapa).
- `onboarding-intro-modal.tsx` — header badge violeta → azul; borda do modal `border-primary/25` → `border-blue-500/25`. Lista de razões mantida multicolor.

## Rodada 5 — Correção de raiz do design system (color-mix)

**Diagnóstico provado:** inspeção do CSS compilado (`.next/dev/.../globals.css`) confirmou
que **nenhuma** regra é gerada para tokens semânticos com opacidade (`bg-primary/10`,
`border-destructive/25`, `bg-muted/50`, etc.). Em Tailwind v3, cores definidas como
`var(--x)` puro não suportam o modificador de opacidade (falta `<alpha-value>`) — a classe
simplesmente não existe no CSS. Isso explica o paradoxo dos botões: `hover:bg-primary/90`
também é no-op, então o botão mantém o `bg-primary` sólido de base no hover (sem quebra
visível).

**Correção** (`tailwind.config.ts`): helper `withAlpha(cssVar)` envolve cada token em
`color-mix(in oklch, var(--x) calc(<alpha-value> * 100%), transparent)`. Aplicado a todos
os tokens semânticos (primary, secondary, muted, accent, destructive, card, popover,
border, input, ring, chart, sidebar.*, background, foreground, highlight).

- Sólidos não regridem: `bg-primary` → alpha-value=1 → 100% → idêntico a `var(--primary)`.
- Variantes de opacidade (hoje no-op) passam a renderizar o valor pretendido.
- `color-mix` já era usado no projeto (`globals.css`, keyframe `pulse-glow`) — suporte de browser ok.
- Sintaxe validada via compile isolado do `tailwindcss@3.4.1` antes de aplicar.

### REVERTIDO — regressão visual

A abordagem `color-mix` foi **revertida** (`tailwind.config.ts` voltou ao original com
`var(--x)` puro). Apesar de o compile isolado mostrar CSS "correto", na prática
`color-mix(in oklch, var(--x) 100%, transparent)` **alterou o tom das cores sólidas
estruturais** (fundo da página, card, sidebar) — o oklch é um espaço polar e a mistura com
`transparent`, mesmo a 100%, não rende idêntico ao valor original no browser. Resultado:
fundo/sidebar ganharam um tom rosado indesejado.

**Aprendizado:** envolver tokens estruturais (background/card/sidebar/foreground) em
`color-mix` é inseguro. O fix de raiz correto seria converter as CSS vars para o formato de
canais (ex.: `--primary: 0.44 0.18 250`) + `oklch(var(--primary) / <alpha-value>)` no config
— o que garante sólidos exatos. É um refactor próprio, com QA dedicado, **não feito aqui**.

**Estado final:** config inalterado vs. baseline. A opacidade em tokens semânticos continua
sendo no-op (limitação conhecida do Tailwind v3 deste projeto). As rodadas 1–4 já contornaram
isso usando a paleta `blue-500` nativa onde precisávamos de azul com opacidade — essas
permanecem válidas e visíveis.

## Pendente

- Fix de raiz do design system (opacidade em tokens) via **formato de canais** + `<alpha-value>` — refactor dedicado com QA visual completo. A abordagem `color-mix` está descartada.

## Validação

- [ ] `pnpm run test:all` (rodar e conferir tabs de settings)
- [ ] Verificação visual light + dark em `/app/settings`, `/app/plans` e sheets de consulta.
