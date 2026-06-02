# Responsividade — leva 1: dropdown collisionPadding + reflow do console de Usuários

**Data:** 2026-06-01
**Escopo:** primeiras correções do [backlog de responsividade](2026-06-01-backlog-responsividade.md) (itens 1, 2, 4, 6, 8).

---

## Item 2 (Critical) — `DropdownMenuContent` com `collisionPadding` default

`src/components/ui/dropdown-menu.tsx` — `DropdownMenuContent` agora aplica `collisionPadding = 8`
por padrão (sobrescrevível por chamada). Impede que menus `align="end"` perto da borda direita
renderizem fora/colados à viewport no mobile. **Alavanca:** propaga para users, requests e todos os
dropdowns do projeto.

## Itens 1, 4, 6, 8 — Console de Usuários responsivo

### `src/app/(admin)/console/users/user-card.tsx` (NOVO)
Apresentação mobile (`<md`) da lista, espelhando `requests/request-card.tsx`. Reaproveita os handlers
do `UsersClient` (sem duplicar lógica de negócio):
- Avatar + nome + **email completo com `break-all`** (item 8 — antes era `truncate` sem fallback).
- Campos: Especialidade, Status (`StatusBadge`), Créditos, Custo Groq (`text-xs` mono p/ caber em
  320px), Cadastro.
- Ações com **tap targets ≥40px** (item 4): Editar + Excluir como botões `h-10`; "Mais ações" em
  dropdown `h-10 w-10` (Bloquear/Desbloquear, Injetar créditos, Redefinir/Gerar PIN). Reflete
  `pinIsTemp`.

### `src/app/(admin)/console/users/users-client.tsx`
- **Item 6:** barra de filtros `flex flex-col gap-2 sm:flex-row`; busca `flex-1 sm:max-w-sm`; Select
  `w-full sm:w-36` — empilham no mobile.
- **Item 1:** reflow `grid gap-3 md:hidden` (cards) + `hidden md:block` (tabela). Removido o
  `overflow-hidden` do wrapper da tabela (anulava o `overflow-auto` interno do `Table` shadcn).

---

## Revisão @responsive-reviewer

Rodado nas mudanças. Resultado: reflow correto e completo (nada essencial só na tabela escondida),
sem overflow em 375/320, tap targets dos botões ≥40px, `collisionPadding` cobre o dropdown na borda.
Únicos pontos Minor/estéticos (quebra do custo Groq mono em 320px — ajustado p/ `text-xs`; altura do
filtro `h-9` — mantida por consistência com o console). Sem desvios bloqueantes.

---

## Validação pendente (antes de merge)

- Rodar testes de unidade/integração que toquem o console de usuários (se houver) e o suite geral.
- E2E console no projeto `mobile` (375px) — confirmar que ações críticas (editar/excluir/bloquear)
  funcionam via card.

## Próximas levas (backlog)

3. `interesses-client.tsx` — reflow/ocultar colunas (Critical, leitura-only).
5. `plans-client.tsx` — migrar 3 modais custom para `AppDialog` (Important).
7. `requests-client.tsx` — mensagem tocável (Minor).
9. `anamnesis-document.tsx` — padding mobile (Minor).
