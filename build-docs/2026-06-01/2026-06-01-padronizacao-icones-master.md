# Padronização de ícones do console (master)

**Data:** 2026-06-01
**Branch:** melhorando-ui-gravacao

## Objetivo

Alinhar os ícones do ambiente master ao design system (tokens, sem hex/violet hardcoded), como já feito no ambiente user. Referência de cor: [[reference_padrao_cores_light_dark]] (`var(--gradient-brand)`, par `text-primary`).

## Alterações

| Item | Arquivo | Antes → Depois |
| --- | --- | --- |
| Coluna Profissional (avatar) | `console/users/users-client.tsx` | gradiente hex inline `#A78BFA→#22D3EE` + `text-violet-900` → `var(--gradient-brand)` + `text-white` |
| Aba Acessibilidade (ícone de seção) | `app/settings/tabs/tab-accessibility.tsx` | `bg-violet-500/15... text-violet-600 dark:text-violet-400` → `bg-primary/10 border-primary/20` + `text-primary` |
| Aba Cancelamento (4 cards de métrica) | `console/feedbacks/feedbacks-client.tsx` | paleta semântica amber/cyan/violet/red → todos unificados em `bg-primary/10` + `text-primary` (decisão do usuário) |
| Filtros de seleção | `console/interesses/interesses-client.tsx` | selecionado `bg-violet-500/15` → `bg-primary text-primary-foreground border-primary` (igual a Console > Solicitações) |

## Notas

- `tab-accessibility.tsx` é **compartilhado** com o lado user — a padronização melhora os dois ambientes (desejável).
- As estrelas de avaliação (`StarRow`) seguem usando amber convencional (não unificadas em primary — são rating).
- Testes dos componentes tocados (`users-client`, `settings-client`) seguem verdes.

## Commits

- `c6887b9` — itens 1, 2, 4 (gradient-brand / primary)
- (este) — item 4 da aba Cancelamento (unificação no primary)
