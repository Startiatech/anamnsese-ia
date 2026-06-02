## Responsividade — padrão do projeto

O Anamnese IA deve ser responsivo **em todo o produto** (lado master/admin e lado user/cliente). Os valores abaixo são a fonte de verdade — não inventar breakpoints novos.

### Breakpoints (padrão Tailwind = padrão de mercado)

| Token | Largura | Alvo típico |
| --- | --- | --- |
| `sm` | 640px | celular grande / paisagem |
| `md` | **768px** | tablet retrato (iPad) |
| `lg` | 1024px | tablet paisagem / laptop pequeno |
| `xl` | 1280px | laptop / desktop |
| `2xl` | 1536px | telas grandes |

Tamanhos de referência testados no Playwright: **375** (celular) · **768** (tablet) · **1280** (laptop) · **1920** (desktop). Piso absoluto: **320px**.

### Níveis de suporte (o que é obrigatório em cada faixa)

| Faixa | Master (admin) | User (cliente / médico) |
| --- | --- | --- |
| **≥768px (tablet+)** | Primeira classe — tudo polido | **Primeira classe / indiscutível** — tudo polido |
| **375–767px (celular)** | **Totalmente funcional** — ações críticas (aprovar/rejeitar pedido, gerenciar) precisam funcionar de verdade | **Utilizável e não-quebrado** — o fluxo funciona se preciso, mas é caso de borda; degradar com elegância, sem obrigação de otimizar cada pixel |
| **320px** | Piso: não pode quebrar layout nem sobrepor texto | Piso: não pode quebrar layout nem sobrepor texto |

Motivação: o master precisa, por exemplo, aprovar um pedido de acesso pelo celular (aviso chega no WhatsApp). No lado do cliente, tablet+ é mandatório; celular numa consulta é improvável mas não pode estar quebrado.

### Regras de layout (valem para os dois lados)

- **Sem scroll horizontal da página** em 375px. Cuidado com larguras fixas (`w-[600px]`), `min-w` grandes e `whitespace-nowrap` em blocos largos.
- **Tabelas densas viram cards abaixo de `md`:** tabela com `hidden md:block` + lista de cards `md:hidden`. A lógica de negócio fica uma vez só; tabela e cards são apenas apresentações. Não deixar `overflow-hidden` cortar o scroll interno do `Table` shadcn.
- **Headers com botão de ação empilham no mobile:** `flex-col` no mobile, `sm:flex-row`/`md:flex-row` acima — o botão nunca sobrepõe o título (ex: `PageHeader` com `action`).
- **Alvos de toque ≥40px** (idealmente 44px) em ações de fluxo crítico no mobile. Evitar ícones soltos `h-4 w-4` sem área tocável.
- **Nada de tooltip hover-only como única via de informação** — no toque não há hover. Usar inline / dialog / sheet.
- **Modais e sheets** (`AppDialog`/`AppSheet`) cabem em 375px sem cortar rodapé/botões.

### Largura máxima de conteúdo (telas grandes)

Em telas grandes, conteúdo não deve colar nas bordas extremas. Use os tokens centralizados de `src/lib/layout.ts` (`LAYOUT_MAX_W`) — **não** espalhar `max-w-*` solto em shells novos. São três tiers intencionais:

| Token | Valor | Onde usar |
| --- | --- | --- |
| `LAYOUT_MAX_W.content` | `max-w-7xl` (1280px) | `<main>` do app/console — **centralizado** (`mx-auto`), recuado, com folga simétrica nos dois lados |
| `LAYOUT_MAX_W.shell` | `max-w-screen-2xl` (1536px) | Fluxo full-screen de atendimento (sidebar `w-64` + conteúdo `max-w-6xl`) |
| `LAYOUT_MAX_W.marketing` | `max-w-5xl` (1024px) | Navbar/topbar pública (alinha com as seções da landing) |

Padrão do app autenticado (app/console):

- **Topbar é full-width** (sem cap): os controles/avatar ficam no **canto** superior direito, como esperado num dashboard. Não capar a topbar — isso faz o avatar "flutuar" no meio em telas grandes.
- **Conteúdo (`<main>`) é centralizado** num bloco recuado (`content` = 1280px, `mx-auto`), com folga igual nos dois lados. A borda direita do conteúdo fica **antes** da linha do avatar.

Login/suspended (split-screen) e banners de alerta seguem full-bleed por design. O console **não** deve receber teto menor — sua dívida é largura insuficiente para tabelas densas (tabela→card), não excesso.

### Enforcement

- Revisar UI nova/alterada com o agente `@responsive-reviewer` (`.claude/agents/responsive-reviewer.md`), que cobra este padrão.
- E2E: validar fluxos críticos no projeto `mobile` (375px) do Playwright.
- O console admin e o lado user têm dívida de responsividade conhecida (tabelas largas, headers) — atacada **incrementalmente, tela por tela**, não tudo de uma vez.
