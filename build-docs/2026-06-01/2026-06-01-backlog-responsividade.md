# Backlog de responsividade — varredura ampla priorizada

**Data:** 2026-06-01
**Origem:** varredura do `@responsive-reviewer` no projeto inteiro (fonte de verdade: `.claude/rules/responsiveness.md`). Alvo mínimo 375px, piso 320px. Severidade calibrada por nível de suporte (master mobile = crítico; user mobile = caso de borda).
**Estratégia:** atacar incrementalmente, tela por tela, priorizando alto efeito-alavanca.

---

## Status

| # | Item | Severidade | Status |
| --- | --- | --- | --- |
| 2 | `dropdown-menu.tsx` — `collisionPadding` default | Critical | ✅ Feito (2026-06-01) |
| 1 | `users-client.tsx` — reflow tabela→cards + remover `overflow-hidden` | Critical | ✅ Feito (2026-06-01) |
| 4 | `users` — tap targets ≥40px no card mobile | Important | ✅ Feito (no card; tabela desktop mantém `size="icon"`) |
| 6 | `users-client.tsx` — filtro busca + Select empilham | Important | ✅ Feito (2026-06-01) |
| 8 | `users-client.tsx` — email completo (`break-all`) no card | Minor | ✅ Feito (2026-06-01) |
| 3 | `interesses-client.tsx` — tabela 5 colunas sem reflow | Critical | ⬜ Pendente |
| 5 | `plans-client.tsx` — 3 modais custom → `AppDialog` | Important | ⬜ Pendente |
| 7 | `requests-client.tsx` — mensagem só em tooltip hover-only | Minor | ⬜ Pendente |
| 9 | `anamnesis-document.tsx` — padding fixo `px-12` em 320px | Minor | ⬜ Pendente |

---

## Detalhe dos itens

### 1. Tabela de Usuários sem reflow + `overflow-hidden` corta scroll (Critical)
`src/app/(admin)/console/users/users-client.tsx:207-309` — 7 colunas, wrapper `overflow-hidden` anula o `overflow-auto` interno do `Table` shadcn; sem lista de cards `md:hidden`. Ações críticas master apertadas/cortadas em 375px.
**Fix:** espelhar `requests-client` (tabela `hidden md:block` + cards `md:hidden` reaproveitando handlers). Remover `overflow-hidden`.

### 2. DropdownMenu `align="end"` sem `collisionPadding` (Critical) — ✅
`dropdown-menu.tsx` ganhou `collisionPadding = 8` default (sobrescrevível). Propaga para users, requests e todos os dropdowns.

### 3. Tabela "Interesses em planos" sem reflow/afordância (Critical)
`src/app/(admin)/console/interesses/interesses-client.tsx:83-112` — 5 colunas sem classes responsivas. Leitura-only.
**Fix:** cards `md:hidden` ou ocultar colunas secundárias (`hidden md:table-cell`) + afordância de scroll.

### 4. Tap targets < 40px (Important)
`users-client.tsx:255-277` (3x `size="icon"` 32px); `requests-client.tsx:240` (`h-8 w-8`). Resolver no reflow para cards com botões ≥40px + label.

### 5. Modais de Planos custom → `AppDialog` (Important)
`plans-client.tsx:76-99,151-174,188-226` — overlays manuais; rodapé rola atrás do teclado em 375px; foge do padrão console (`AppDialog`).

### 6. Filtro busca + Select não empilham (Important)
`users-client.tsx:165-196` — `flex gap-3` sem `flex-col`. **Fix:** `flex flex-col gap-2 sm:flex-row` + `w-full sm:w-36`.

### 7. Tooltip hover-only para "Ver mensagem" (Minor)
`requests-client.tsx:217-233` — sem hover no touch (tablet onde a tabela é a view). Tornar tocável (já é `<button>`): abrir em `AppDialog`/`Popover`.

### 8. `truncate` em email sem fallback (Minor)
`users-client.tsx:233` — no card mobile exibir email completo com `break-all`.

### 9. Documento de anamnese padding fixo (Minor)
`src/components/anamnesis/anamnesis-document.tsx:33-34` — `px-12 py-12` espreme em 320px. **Fix:** `px-6 py-8 md:px-12 md:py-12` + `print:px-12` para preservar o print.

---

## Ranking de ataque incremental

1. `dropdown-menu.tsx` — `collisionPadding` (✅ feito; alavanca máxima)
2. `users-client.tsx` — reflow + itens 4, 6, 8 juntos (tela master mais quebrada)
3. `plans-client.tsx` — 3 modais → `AppDialog` (responsividade + conformidade)
4. `interesses-client.tsx` — cards/ocultar colunas
5. Refinos: mensagem tocável (requests) + padding mobile (anamnesis)

## Áreas verificadas e OK
`PageHeader`, `requests-client` (referência do padrão tabela/cards), fluxo de atendimento (`consultation-page-flow`), `history-client`, `consultation-page-client`, `AppSheet`/`AppDialog`, `step-indicator`, `recent-activity`.
