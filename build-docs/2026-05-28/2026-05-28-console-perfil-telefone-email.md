# Console / Perfil: campos Telefone e Email

**Data:** 2026-05-28

## Objetivo

A aba Perfil do console (master) editava apenas o Nome. Adicionar campos que fazem sentido para o ambiente do master: **Telefone/WhatsApp** (editável) e **Email** (read-only). O telefone tem peso real — o master recebe aviso de pedido de acesso no WhatsApp.

Escopo decidido em brainstorming: Nome (edit) + Telefone (edit) + Email (read-only). Avatar e "membro desde" ficaram de fora. Nada clínico (CRM/especialidade/clínica) — não é papel do master.

## Alterações

### Schema
- `src/lib/schemas.ts` — novo `masterProfileSchema` (`name` min 2 / max 100; `phone` opcional, max 20). Email **não** entra no schema (read-only ⇒ proteção contra mass assignment).

### Server Action
- `src/server/actions/settings.ts` — `updateMasterProfile` aceita `phone?`, valida via `masterProfileSchema` e persiste `{ name, phone }` (e `passwordHash` no fluxo de troca de senha). Email nunca é aceito.

### UI
- `src/app/(admin)/console/settings/page.tsx` — busca `findUserById(sessionUser.sub)` e passa `userName`, `userEmail`, `userPhone` (antes só `userName` do JWT). Redireciona para login se o usuário não for encontrado.
- `src/app/(admin)/console/settings/settings-client.tsx` — repassa `userEmail`/`userPhone` ao `TabProfile`.
- `src/app/(admin)/console/settings/tabs/tab-profile.tsx` — campo **Telefone/WhatsApp** (editável, `data-testid="console-profile-phone"`) + **Email** read-only (`disabled`, `data-testid="console-profile-email"`). Form passa a usar `masterProfileSchema`.

### Testes (TDD)
- **Unit (action)** `settings.test.ts` — persiste phone (com/sem senha); rejeita phone > 20; casos existentes ajustados para `phone: undefined`.
- **Unit (componente)** `console/settings/tabs/tab-profile.test.tsx` (novo) — email read-only; pré-preenche phone; submit chama action com `{ name, phone }`.
- **Unit (page)** `console/settings/page.test.ts` — mock de `findUserById`; novo caso de redirect quando usuário não encontrado.
- **Unit (settings-client)** — render atualizado com os novos props.
- **Integração** `users.integration.test.ts` — `updateUser({ phone })` persiste no banco real.
- **E2E** `console/configuracoes.spec.ts` — editar telefone persiste (snapshot/restore do `phone` do master) + email read-only via `data-testid`.

## Validação

- Unitários afetados: **18 passando** (4 arquivos).
- Integração: **43 passando**.
- E2E console: ver nota sobre flakiness resolvida abaixo.

## Flakiness do registro compartilhado do master — resolvida

**Causa raiz:** `playwright.config.ts` usa `fullyParallel: true` + `workers: 2` + 4 projetos de viewport. O mesmo teste de mutação rodava em projetos diferentes ao mesmo tempo, todos gravando no **mesmo registro do master**. Pior: `restoreMaster` reescrevia a linha inteira (name + phone + password_hash), então até testes de colunas diferentes se atropelavam no `finally`.

**Correção** (`e2e/specs/console/configuracoes.spec.ts`): os 4 testes que fazem snapshot/restore do master (`editar nome`, `editar telefone`, `senha incorreta`, `validacao client-side`) foram agrupados num `test.describe` com `mode: 'serial'` e um `beforeEach` que faz `test.skip` em todo projeto que não seja `desktop`. Resultado: só um teste muta o master por vez (serial) e só num projeto (sem corrida cross-viewport). Os testes read-only (abas, segurança, acessibilidade) seguem multi-viewport. Helper `disableSonnerPointerEvents` removido (só era usado nos branches mobile desses testes, agora desktop-only).

- `docs/architecture.md` ganhou a seção "Configurações do Console (master)".
