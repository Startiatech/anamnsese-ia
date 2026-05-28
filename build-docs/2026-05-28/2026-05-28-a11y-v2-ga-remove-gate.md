# Acessibilidade Fase 3 → GA: remoção do feature flag `betaA11yV2`

**Data:** 2026-05-28

## Objetivo

Promover os 3 toggles da Fase 3 de acessibilidade (espaçamento de leitura, destacar elemento em foco, reduzir movimento) de beta gated para **GA** — visíveis para todos os usuários. Remover o feature flag `betaA11yV2` / coluna `users.beta_a11y_v2`, que não deve permanecer no código sem função.

## Alterações

### Código (remoção do gate)
- `src/context/accessibility-context.tsx` — removido `betaA11yV2` do context value e `initialBetaA11yV2` das props do provider.
- `src/app/(app)/app/settings/tabs/tab-accessibility.tsx` — removido o `{betaA11yV2 && (...)}` que escondia os 3 `SectionCard`; agora sempre renderizados.
- `src/app/(app)/layout.tsx`, `src/app/(app)/app-layout-client.tsx` — removido o repasse de `initialBetaA11yV2`.
- `src/app/(admin)/console/layout.tsx`, `src/app/(admin)/console/admin-layout-client.tsx` — idem.
- `src/server/repositories/users.ts` — removido `betaA11yV2` de `StoredUser` e do mapeamento `toStoredUser` (coluna `beta_a11y_v2`).
- `src/app/api/admin/create-user/route.ts` — removido `betaA11yV2: false` do payload de criação.

### Banco de dados
- **Nova migration** `supabase/migrations/20260528b_drop_beta_a11y_v2.sql` — `drop column if exists beta_a11y_v2`. Aplicar nos 2 bancos (prod e teste).
- `supabase/seeds/20260525c_phase3_announcement.sql` — removido o `update users set beta_a11y_v2 = true`; mantida a notificação de anúncio do sino.

### Testes
- `src/app/(app)/app/settings/tabs/tab-accessibility.test.tsx` — describe "Fase 3 (gated)" reescrito para "GA, sempre visível"; removido o teste que verificava ausência dos toggles com flag off.
- `src/lib/users.test.ts`, `src/server/repositories/users.integration.test.ts`, `src/server/repositories/users-accessibility.test.ts`, `src/app/(app)/app/settings/settings-client.test.tsx`, `src/app/(app)/app/settings/settings-client-clinic.test.tsx` — removidas as referências a `betaA11yV2` nos fixtures/assertions.

### Docs
- `docs/accessibility.md` — seção "Toggles disponíveis" não mais marcada como gated; nota explicando que os toggles são GA e o flag foi removido.

## Validação

`pnpm run test:all` — **778 testes passando (107 arquivos)** + **42 de integração (7 arquivos)**.

## Aba Acessibilidade no console master

Adicionada a aba **Acessibilidade** ao settings do console (`(admin)/console/settings`), disponível para o master — a funcionalidade deve estar acessível em qualquer role.

- `src/app/(app)/app/settings/tabs/tab-accessibility.tsx` — `TabAccessibility` ganhou prop opcional `showRequestCard` (default `true`); o `RequestFeedbackCard` agora é renderizado condicionalmente.
- `src/app/(admin)/console/settings/settings-client.tsx` — nova tab `acessibilidade` reutilizando `TabAccessibility` com `showRequestCard={false}` (o card de pedido envia ao master; não faz sentido o master enviar a si mesmo).
- `src/app/(admin)/console/settings/settings-client.test.tsx` — novo teste: aba existe e renderiza o painel com `showRequestCard=false`.
- `src/app/(app)/app/settings/tabs/tab-accessibility.test.tsx` — testes para a prop `showRequestCard` (default exibe; `false` oculta).
- O `AccessibilityProvider` já envolve o console via `console/layout.tsx`, então `useAccessibility()` funciona sem mudanças no layout.

## Cobertura E2E (Playwright)

- `e2e/specs/console/configuracoes.spec.ts` — novo teste read-only: aba Acessibilidade exibe os toggles (fonte, contraste, espaçamento, foco, movimento) e NÃO mostra o card de pedido. Não clica nos toggles (master é registro compartilhado; auto-save mutaria as prefs). Comentário do header atualizado para "três abas".
- `e2e/specs/app/settings.spec.ts` — novo teste: aba Acessibilidade exibe os 3 toggles GA + card de pedido; ativar "Espaçamento aumentado" persiste `pref_spacing_increased = true` no banco (validação por polling).

## Pendências / notas

- Migration `20260528b` aplicada nos 2 bancos (prod e teste). ✓
