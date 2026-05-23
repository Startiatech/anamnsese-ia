# Anamnese IA

SaaS de anamnese médica com transcrição de áudio e geração de relatório via IA. Invite-only.

**Stack:** Next.js 16 App Router · React 19 · TypeScript · Tailwind CSS · shadcn/ui · `jose` (JWT) · Supabase · Vitest + RTL

---

## Arquitetura

Route groups: `(marketing)/` · `(auth)/` · `(app)/` · `(admin)/console/` · `src/app/suspended/`

`src/server/` — exclusivamente server-side, nunca importar em `'use client'`:

- `supabase.ts` — cliente service_role
- `services/auth.ts` · `services/session.ts` → `getServerUser()`
- `repositories/users.ts`, `db.ts`, `credits.ts`, `requests.ts`
- `actions/plans.ts` — Server Actions de planos

`src/lib/` — compartilhado: schemas Zod, types, utils, `routes.ts`, `request-policy.ts`

---

## Arquivos-chave

| Arquivo | Papel |
| --- | --- |
| `src/proxy.ts` | Proteção de rotas (Next.js 16 — não é middleware.ts) |
| `src/app/(app)/layout.tsx` | Layout autenticado (Server Component) |
| `src/app/(admin)/console/layout.tsx` | Layout admin (Server Component) |
| `src/context/AppContext.tsx` | Usuário real, créditos, logout |
| `src/context/ConsultationContext.tsx` | Estado do fluxo de atendimento |
| `src/lib/routes.ts` | `ROUTES.*` e `API.*` — todas as rotas centralizadas |
| `src/lib/schemas.ts` | Schemas Zod centralizados |
| `src/components/layout/` | Sidebar, Topbar, MobileSidebar |
| `src/components/ui/app-sheet.tsx` | Sheet lateral padrão do projeto |
| `src/components/ui/app-dialog.tsx` | Modal centrado padrão do projeto |

---

## Documentação de arquitetura

`docs/architecture.md` contém os diagramas Mermaid do projeto. **Obrigatório atualizar este arquivo sempre que uma nova funcionalidade for implementada** — adicionar ou ajustar o diagrama correspondente (fluxo, rota, componente, integração) junto com o código entregue.

---

## Comandos proibidos de executar via terminal

**REGRA OBRIGATÓRIA:** Os comandos abaixo NUNCA devem ser executados via terminal pelo assistente. Ao precisar do output de qualquer um deles, solicitar explicitamente ao usuário que rode e cole o resultado relevante.

| Comando | Motivo |
| --- | --- |
| `git log` (qualquer variação) | Output potencialmente enorme, baixo valor de contexto |
| `git diff` sem `--stat` | Output potencialmente enorme — usar sempre `git diff --stat` |
| `pnpm install` / `npm install` | Centenas de linhas sem valor de contexto |
| `pnpm add` / `npm install <pacote>` | Mesmo motivo acima |
| `pnpm run test:all` | Output enorme — usuário roda e cola apenas erros relevantes |
| `pnpm test` / `pnpm run test:integration` | Mesmo motivo acima |
| `pnpm run build` / `next build` | Proibido por convenção do projeto |
| `pnpm run dev` / `next dev` | Processo persistente, sem valor de output direto |
| `docker logs` / `docker compose logs` | Output potencialmente enorme |

**Como proceder:** ao precisar de qualquer um desses outputs, dizer ao usuário:
> "Por favor, rode `<comando>` e cole aqui o resultado (ou apenas a parte relevante)."

---

## Convenções obrigatórias

- Português para comunicação e **mensagens de commit**, inglês para código
- **Conventional Commits obrigatório** — formato `tipo(escopo): descrição em pt-br` · Tipos: `feat` · `fix` · `refactor` · `test` · `docs` · `chore` · `style` · `perf` · `ci` · Escopo opcional mas recomendado (ex: `feat(auth): adiciona validação de token`)
- **TDD obrigatório** — sequência completa via agente `tdd-guide`. `pnpm test` · `pnpm run test:integration` · `pnpm run test:all`
- **Proibido rodar build** automaticamente — usar apenas `pnpm run test:all` para validar. Build só sob instrução explícita
- Rotas hardcoded proibidas — sempre `ROUTES.*` ou `API.*` de `src/lib/routes.ts`
- Imports server-side: `@/server/*` direto — nunca `@/lib/*` em código novo
- Todo acesso ao Supabase: server-side via service_role, nunca no client
- Auth: JWT cookie httpOnly `anamnese_auth` — sem NextAuth, sem Clerk · Roles: `user` | `admin` | `master`
- **TypeScript:** proibido `any` — usar `unknown`; `as SomeType` só quando a lib não exporta o tipo (documentar inline)
- **Libs externas:** verificar versão no `package.json` e consultar docs da versão instalada

---

## Padrão de UI para formulários e ações

| Contexto | Componente | Quando usar |
| --- | --- | --- |
| Console admin `(admin)/console/` | `AppDialog` | Ações pontuais e administrativas (criar usuário, confirmar exclusão) — modal centrado, compacto |
| Fluxo app `(app)/` | `AppSheet` | Formulários dentro do fluxo de trabalho contínuo (criar paciente, editar dados) — painel lateral preserva contexto da tela |

Nunca inverter: não usar `AppSheet` no console admin nem `AppDialog` dentro do fluxo de consulta.

---

## Agentes especializados

Invocar com `@nome-do-agente` para revisão isolada. Agentes em `.claude/agents/`.

- `@security-reviewer` — endpoints, schemas, API routes, Server Actions
- `@tdd-guide` — guia TDD passo a passo para repositórios e features
- `@ui-reviewer` — conformidade visual de componentes e páginas
- `@async-actions-reviewer` — loading, toast, redirect em formulários e mutations
- `@stripe-reviewer` — webhooks, checkout, idempotência, sincronização planos/créditos
- `@e2e-playwright-reviewer` — locators, viewports, mocks de IA e flakiness em specs Playwright

---

## Superpowers skills (invocação proativa)

| Situação | Skill |
| --- | --- |
| Nova feature com múltiplos arquivos ou decisões de arquitetura | `superpowers:brainstorming` → `superpowers:writing-plans` |
| Executar um plano existente em `docs/superpowers/plans/` | `superpowers:executing-plans` |
| Feature complexa do zero (ex: Stripe, E2E, módulo novo) | `superpowers:subagent-driven-development` |
| Bug difícil de reproduzir ou com causa raiz incerta | `superpowers:systematic-debugging` |
| Antes de marcar uma task como concluída | `superpowers:verification-before-completion` |
