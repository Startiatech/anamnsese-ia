# Senha provisória com CSPRNG em todos os call sites

**Data:** 2026-06-09
**Tipo:** `fix(security)`
**Origem:** auditoria de segurança dirigida (item 3, ALTO) — dívida conhecida

## Problema

A senha provisória enviada ao novo usuário era gerada com `Math.random().toString(36)` em dois pontos do console admin — previsível, não-CSPRNG. O `requests-client.tsx` já havia sido corrigido para `crypto.getRandomValues`, mas com helper local (duplicação).

## Correção

- Novo util compartilhado `src/lib/temp-password.ts` (`generateTempPassword`) — CSPRNG via `crypto.getRandomValues`, 16 hex chars (~64 bits).
- Três call sites passam a usar o util:
  - `add-user-modal.tsx` (era `Math.random`)
  - `console-dashboard-client.tsx` (era `Math.random`)
  - `requests/requests-client.tsx` (remove helper local duplicado)

## Arquivos alterados

- `src/lib/temp-password.ts` — novo util CSPRNG
- `src/lib/temp-password.test.ts` — novo (formato hex + entropia)
- `src/app/(admin)/console/users/add-user-modal.tsx`
- `src/app/(admin)/console/console-dashboard-client.tsx`
- `src/app/(admin)/console/requests/requests-client.tsx` — desduplicação

## Pendência relacionada

- Item 4 (alto): `temp_password_plain` é gravada em texto plano no banco para o fluxo "Ver credenciais" — decisão de produto, avaliar criptografia em repouso ou fluxo de link de definição de senha.
