# Build 2026-05-27 — Solicitações responsivo mobile

## Contexto

Durante teste com cliente real, o master precisou aprovar/rejeitar um pedido de acesso **pelo celular** (aviso chega via WhatsApp, sem PC à mão). No celular o comportamento não era fluido: ações sumiam e cliques não funcionavam porque o conteúdo ficava oculto em tela menor.

## Diagnóstico (baseline @responsive-reviewer, 375px)

A tela de Solicitações era uma tabela de 7 colunas desenhada exclusivamente para desktop:

1. Tabela não cabia em 375px e o wrapper `overflow-hidden` cortava o scroll interno → ações ficavam inalcançáveis.
2. Ações Aprovar/Rejeitar escondidas num `DropdownMenu align="end"` que renderizava fora da borda + trigger de apenas 32px.
3. Mensagem do solicitante exibida apenas via `Tooltip` (hover-only, inoperante no toque).
4. Botão "copiar senha" com alvo de toque de 32px num fluxo irreversível.

## Alterações

### 1. `RequestCard` — card mobile apresentacional

- **Arquivo:** [`src/app/(admin)/console/requests/request-card.tsx`](../../src/app/(admin)/console/requests/request-card.tsx)
- **Mudança:** novo componente apresentacional que exibe um pedido no formato card para telas mobile. Contém: nome + e-mail completo, especialidade / telefone / badge de situação / data, mensagem inline com controle "ver mais / ver menos" (sem tooltip), e ações diretas por status — Aprovar/Rejeitar quando `pending`, Ver credenciais quando `approved` com senha temporária. Sem lógica de negócio: o card apenas dispara os handlers recebidos por props. Identificado por `data-testid="request-card"`.

### 2. `requests-client` — layout responsivo unificado

- **Arquivo:** [`src/app/(admin)/console/requests/requests-client.tsx`](../../src/app/(admin)/console/requests/requests-client.tsx)
- **Mudança:** tabela existente recebe `hidden md:block` (visível apenas no tablet/desktop) e nova lista `md:hidden` renderiza os `RequestCard`s no mobile. Handlers, filtros, `processingId` e `CredentialsDialog` são compartilhados entre as duas vistas — **lógica única, sem duplicação**. O `overflow-hidden` que cortava o scroll interno foi confinado exclusivamente ao wrapper desktop. Divisor de breakpoint: `md` = 768px (celular = cards, tablet+ = tabela).

### 3. `credentials-dialog` — alvo de toque acessível

- **Arquivo:** [`src/app/(admin)/console/requests/credentials-dialog.tsx`](../../src/app/(admin)/console/requests/credentials-dialog.tsx)
- **Mudança:** botão "Copiar senha" ampliado para alvo de toque ≥ 44px, com label visível "Copiar" / "Copiado" (além do `aria-label` mantido). Senha exibida em `<code>` com `min-w-0 truncate` para evitar overflow em telas estreitas.

### 4. `PageHeader` — título responsivo

- **Arquivo:** [`src/components/console/page-header.tsx`](../../src/components/console/page-header.tsx)
- **Mudança:** classe de tamanho do título alterada para `text-2xl md:text-3xl`, melhorando a legibilidade do cabeçalho em todo o console no mobile. O empilhamento título + botão de ação fica deferido para iteração futura.

### 5. E2E mobile — spec de solicitações

- **Arquivo:** [`e2e/specs/console/solicitacoes.spec.ts`](../../e2e/specs/console/solicitacoes.spec.ts)
- **Mudança:** cenário adicionado ao projeto `mobile` (375px): verifica que o card é visível, que os botões Aprovar e Rejeitar estão acessíveis (escopados por `data-testid`), e que não há scroll horizontal. **Não executado no ambiente de implementação** — requer dev server + Supabase teste + browsers instalados. Rodar com:
  ```
  pnpm test:e2e e2e/specs/console/solicitacoes.spec.ts --project=mobile
  ```

## Entregáveis de processo

- **`.claude/rules/responsiveness.md`** — regra de responsividade do projeto: breakpoints Tailwind (640/768/1024/1280/1536), níveis de suporte (master funcional no celular; usuário tablet+ primeira classe, celular utilizável/caso de borda), e diretrizes de layout.
- **`.claude/agents/responsive-reviewer.md`** — agente especializado em revisão de responsividade; invocável via `@responsive-reviewer` para baseline e revisão de novas telas.

## Decisões de design

| Decisão | Escolha | Motivo |
|---|---|---|
| Abordagem de layout mobile | Reflow para cards (Abordagem A) | YAGNI — primitivo genérico prematuro; CSS puro não entregaria paridade funcional |
| Ações no mobile | Diretas no card (sem dropdown) | Dropdown renderiza fora da borda em 375px; ações diretas eliminam o problema na raiz |
| Breakpoint de alternância | `md` = 768px | Celular = cards; tablet+ = tabela — alinhado às regras do projeto |
| Mensagem do solicitante | Inline com "ver mais/ver menos" | Tooltip é hover-only; texto inline funciona no toque sem custo de acessibilidade |

## TDD / Cobertura

| Arquivo de teste | Testes | Status |
|---|---|---|
| `request-card.test.tsx` | 8 | Passando |
| `requests-client.test.tsx` | 4 (inclui aprovar e rejeitar via card) | Passando |
| `credentials-dialog.test.tsx` | 3 | Passando |
| `e2e/specs/console/solicitacoes.spec.ts` (projeto `mobile`) | Escrito | Pendente execução (requer ambiente completo) |

## Fora de escopo (futuro, incremental)

- Reflow das tabelas de Usuários e Planos para mobile.
- Empilhamento do `PageHeader` com botão de ação no mobile.
- Primitivo genérico `ResponsiveTable` (regra de três — aguardar terceiro caso de uso).
