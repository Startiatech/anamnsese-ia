# Indicador de status da aba Acessibilidade + correção de overflow das tabs no mobile

**Data:** 2026-06-01
**Escopo:** UI/UX da aba Acessibilidade (lado user e console) e responsividade do `UnderlineTabs`.

---

## Contexto / problema

Na aba **Acessibilidade** (compartilhada entre `(app)/app/settings` e `(admin)/console/settings`
via `TabAccessibility`), o feedback de salvamento (Salvando / Salvo / Erro) era exibido por um
`StickyStatusIndicator` no topo da aba, que **reservava um slot fixo permanente** (`h-7` + wrapper
sticky). Isso deixava a aba com um respiro a mais no topo, destoando das demais tabs (Perfil, Clínica,
Segurança), que começam direto no conteúdo.

Além disso, em telas estreitas (375px) a régua de tabs (`UnderlineTabs`) estourava a largura da
página — `flex` sem `nowrap`/scroll com 4 tabs no lado user — gerando **scroll horizontal na página
inteira** e "comendo" o respiro lateral direito (`px-4` do container).

---

## Decisões de UX (iterativas, com o usuário)

Evolução do indicador de status até a forma final:

1. Topo fixo (original) → reservava espaço feio, destoava das outras tabs.
2. Flutuante no canto da aba → não visível ao alterar o último item (fora do scroll).
3. Fixo no rodapé da viewport → resolvia scroll, mas ficava longe do controle ao mexer no 1º item.
4. Inline no cabeçalho do card → "colado" no texto.
5. **Forma final:** chip inline **no card que disparou o save**, em **slot de altura reservada**
   (sem layout shift), na mesma direção do controle:
   - **Cards de toggle:** `ToggleRow` → switch à esquerda, `StatusSlot` à direita (mesma linha).
   - **Card "Tamanho da fonte":** chip **por bloco/opção** (Normal/Grande/Extra grande) — só a opção
     selecionada exibe o chip; slot reservado nas três para alturas iguais.

---

## Alterações

### `src/app/(app)/app/settings/tabs/tab-accessibility.tsx`
- Removido `StickyStatusIndicator` (slot fixo no topo).
- Novo `StatusChip` — chip compacto com os 3 estados; erro encurtado para "Não foi possível salvar."
  (cabe inline no mobile; ainda casa com o teste `/n.o foi poss.vel salvar/i`). `whitespace-nowrap` +
  ícones `shrink-0` evitam quebra/vazamento.
- Novo `StatusSlot` — container `h-7` **sempre reservado** (elimina layout shift), chip alinhado à
  direita; vazio quando `idle`.
- Novo `ToggleRow` — switch + `StatusSlot` na mesma linha (`justify-between`).
- `TabAccessibility` rastreia `activeCard` via helper `withCard(...)`; só o card alterado exibe o chip
  (`statusFor`). No card de fonte, o status é por opção (`activeCard === 'font' && active`).

### `src/components/ui/underline-tabs.tsx`
- `nav` agora `flex-nowrap overflow-x-auto` com scrollbar oculta
  (`[scrollbar-width:none] [&::-webkit-scrollbar]:hidden`).
- Cada tab com `shrink-0 whitespace-nowrap`.
- Resultado: em telas estreitas a **barra de tabs rola horizontalmente** em vez de a página inteira;
  o `px-4` simétrico do container volta a dar respiro nos dois lados. Correção compartilhada entre
  user, console e qualquer outra tela que use `UnderlineTabs`.

### `e2e/specs/app/settings.spec.ts`
- Ajuste de spec desatualizado: o produto normaliza nomes via `capitalizeName` (`src/lib/utils.ts`),
  então `E2E` virava `E2e` ao persistir. Os testes passaram a usar nomes **já em formato canônico**
  (`E2e Nome`, `E2e Clinica`) — capitalizeName vira no-op e a asserção valida persistência real sem
  re-derivar a regra (e2e não importa de `src/`). Não é regressão das mudanças de UI.

---

## Responsividade (breakpoints)

- 375px: sem scroll horizontal da página; tabs rolam dentro da própria barra; chip não vaza
  (`shrink-0` + `whitespace-nowrap`); slot reservado evita "pulo" da UI.
- Padding do container já era simétrico: `container max-w-5xl mx-auto px-4` em ambos os layouts
  (`(app)/app-layout-client.tsx` e `(admin)/console/admin-layout-client.tsx`).

---

## Validação

- `pnpm test tab-accessibility` — verde (inclui os 3 testes do status indicator).
- `pnpm exec playwright test e2e/specs/app/settings.spec.ts e2e/specs/console/configuracoes.spec.ts --project=mobile`
  — fluxos de tabs/aba Acessibilidade passam; as 2 falhas observadas eram o descasamento de
  `capitalizeName` (corrigido no spec), não regressão de UI.

## Revisão @responsive-reviewer (pós-implementação)

Rodado o agente nos arquivos alterados; 3 desvios corrigidos:

1. **Chip de erro estourando coluna de fonte em `sm`/tablet (Important).** No grid `sm:grid-cols-3`
   cada coluna fica ~158px úteis; o chip de erro com `whitespace-nowrap` (~185px) era cortado.
   Fix: `StatusChip`/`StatusSlot` ganharam prop `wrap` — nas opções de fonte o chip quebra em 2 linhas
   (`rounded-lg whitespace-normal`, slot `min-h-7`). Texto do erro mantido (não quebra o teste). Toggles
   seguem `nowrap` (cabem).
2. **Tap target do switch 24px de altura (Important).** Abaixo do mínimo ~40px para toque.
   Fix: pseudo `before:-inset-y-2 before:inset-x-0` amplia a área tocável para ~40px sem mudar o visual
   do trilho (24px).
3. **Sem afordância de scroll na barra de tabs (Minor).** Com scrollbar oculta a tab ativa podia ficar
   fora de vista. Fix: `UnderlineTabs` faz `scrollIntoView({ inline: 'nearest' })` na tab ativa ao mudar.

> Lição de processo: o `@responsive-reviewer` deve ser acionado **proativamente** ao editar UI, não só
> depois que o usuário encontra o problema no teste manual (registrado em memória).

## Pendências / follow-up

- Opcional: adicionar asserção explícita de ausência de scroll horizontal
  (`document.documentElement.scrollWidth <= window.innerWidth`) no projeto `mobile` para essas páginas.
