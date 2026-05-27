# Solicitações de acesso — responsividade mobile (cards)

**Data:** 2026-05-27
**Status:** Aprovado (brainstorming)

## Contexto e problema

Durante teste com cliente real, o master precisou acessar o console **pelo celular** para aprovar/rejeitar um pedido de acesso (o aviso chega no WhatsApp e nem sempre há um PC à mão). O comportamento no celular não foi fluido: ações não apareciam e cliques não funcionavam — conteúdo ficava oculto em tela menor.

### Causa raiz (baseline do @responsive-reviewer, viewport 375px / piso 320px)

A tela de Solicitações ([requests-client.tsx](src/app/(admin)/console/requests/requests-client.tsx)) é uma **tabela de 7 colunas** desenhada para desktop:

1. **Critical** — Tabela não cabe em 375px. O wrapper externo tem `overflow-hidden` que **corta** o `overflow-auto` interno do `Table` shadcn → a coluna de ações (extrema direita) fica inalcançável.
2. **Critical** — Ações Aprovar/Rejeitar escondidas num `DropdownMenu align="end"` que renderiza colado/fora da borda direita no mobile; trigger `size="icon"` (32px) abaixo do alvo de toque.
3. **Critical** — Mensagem do solicitante exposta só via `Tooltip` (hover-only) → ilegível no toque.
4. **Important** — `whitespace-nowrap` na data agrava o overflow.
5. **Important** — Email sem tratamento adequado nos cards.
6. **Minor** — Botão de copiar senha no `credentials-dialog` (32px) num fluxo irreversível (senha não reaparece).

## Decisões (entrevista)

- **Escopo agora:** apenas a tela de Solicitações (fluxo crítico aprovar/rejeitar pelo celular).
- **Abordagem A — reflow para cards** (pontual, com padrão limpo e reutilizável depois). Descartadas: primitivo genérico `<ResponsiveTable>` (YAGNI/abstração prematura a partir de 1 exemplo) e reflow CSS puro da `<table>` (frágil/a11y ruim).
- **Paridade total** no card mobile: nome+email, especialidade, telefone, mensagem inline, badge de situação, data, e ações por status. Filtros continuam funcionando.
- Padrão de breakpoint: tabela `hidden md:block` / cards `md:hidden` (divisor `md` = 768px).

## Arquitetura

Mudança concentrada na pasta da rota de Solicitações. Lógica de negócio **compartilhada** (uma vez só no client); tabela e cards são duas apresentações do mesmo estado.

| Arquivo | Papel |
| --- | --- |
| `src/app/(admin)/console/requests/request-card.tsx` | **Novo.** Componente apresentacional de um pedido no mobile. Recebe `request`, `processing`, `onApprove`, `onReject`, `onViewCredentials`. Sem fetch/WhatsApp — só apresentação + eventos. |
| `src/app/(admin)/console/requests/requests-client.tsx` | **Modificar.** Tabela ganha `hidden md:block`; nova lista `md:hidden` mapeia `sorted` em `<RequestCard>`. Handlers, filtros, `processingId` e `CredentialsDialog` permanecem e são compartilhados. `overflow-hidden` fica só no wrapper da tabela (desktop). |
| `src/app/(admin)/console/requests/credentials-dialog.tsx` | **Modificar.** Botão de copiar senha com alvo de toque ≥44px (rótulo "Copiar" visível ou `h-11 w-11`), sem quebrar o comportamento de cópia. |
| `src/app/(admin)/console/requests/request-card.test.tsx` | **Novo.** Testes unitários do card. |
| `src/app/(admin)/console/requests/requests-client.test.tsx` | **Criar/Modificar.** Cobre presença responsiva (cards `md:hidden` / tabela `hidden md:block`) e que ações via card compartilham a lógica. |
| `src/app/(admin)/console/requests/credentials-dialog.test.tsx` | **Criar/Modificar.** Cópia ainda funciona após o ajuste do botão. |
| `e2e/specs/console/solicitacoes.spec.ts` | **Modificar.** Teste no projeto `mobile` (375px): botões Aprovar/Rejeitar visíveis e clicáveis num pedido pendente. |

## Comportamento do `RequestCard`

- **Por status:** `pending` → botões **Aprovar** / **Rejeitar** diretos (sem dropdown), `h-10` (≥40px), lado a lado. `approved` + `userPasswordIsTemp` → botão **Ver credenciais**. `rejected` / `approved` sem temp → só dados, sem ações.
- **Mensagem inline:** aparece só quando `request.message` existe; entre aspas, com `line-clamp` + "ver mais" tocável se longa. Nunca via tooltip.
- **Email** completo inline (sem truncate). Data legível em linha própria.
- **Processing:** `processing` (mesmo `processingId` da tabela) desabilita os botões e mostra "Aguarde...".
- Sem lógica de negócio interna — apenas dispara os handlers recebidos por props.

A tabela desktop permanece intacta (dropdown `⋯` + tooltip fazem sentido lá).

## Testes (TDD — RED → GREEN → REFACTOR)

| Peça | Tipo | Cobertura |
| --- | --- | --- |
| `request-card.tsx` | Unitário (RTL) | Render por status; cliques chamam handler correto; `processing` desabilita; mensagem inline condicional; email completo presente. |
| `requests-client.tsx` | Integração (RTL) | Cards no container `md:hidden`, tabela no `hidden md:block`; aprovar/rejeitar via card altera estado e dispara toast igual à tabela. |
| `credentials-dialog.tsx` | Unitário | Botão de copiar (alvo ampliado) ainda copia a senha. |
| Fluxo mobile | E2E (Playwright, projeto `mobile` 375px) | Em pedido pendente, Aprovar/Rejeitar visíveis e clicáveis sem scroll horizontal. Sinais observáveis, sem `waitForTimeout`. |

RTL não tem viewport real → valida estrutura/classes responsivas e handlers; a validação visual de 375px é do E2E (projeto `mobile`) e do `@responsive-reviewer`.

## Entregáveis de processo

- Build-doc: `build-docs/2026-05-27/2026-05-27-solicitacoes-responsivo-mobile.md`.
- Atualizar `docs/architecture.md` se houver diagrama do console afetado (caso contrário, dispensável).

## Fora de escopo (YAGNI / futuro)

- Reflow das tabelas de Usuários e Planos (mesmo padrão, quando atacarmos o console mobile inteiro).
- Empilhamento do `PageHeader` (título + botão de ação) no mobile — afeta telas com `action` (ex: Usuários "Novo usuário"), não a de Solicitações.
- Primitivo genérico `<ResponsiveTable>` — extrair só após 2-3 telas usarem o padrão de cards (regra de três).
