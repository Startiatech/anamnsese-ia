# findUserByEmail/findUserById propagam erro real do Supabase

**Data:** 2026-06-09
**Tipo:** `fix(repo)`
**Origem:** auditoria de segurança dirigida (item 6, MÉDIO)

## Problema

`findUserByEmail` e `findUserById` descartavam o `error` retornado pelo Supabase e retornavam `undefined` em qualquer falha. Consequência: uma falha de infraestrutura (banco pausado/indisponível) era mascarada como "usuário não encontrado" — foi exatamente o que fez o login retornar **401 "Email ou senha incorretos"** quando o banco dev estava pausado, escondendo a causa real.

## Correção

Ambas as funções passam a inspecionar `error`:
- `PGRST116` (nenhuma linha) → `undefined` (caso esperado, sem mudança de comportamento).
- Qualquer outro erro → lança `Error` com a mensagem do Supabase.

Efeito: falha de banco agora propaga como **500** (login, `requireActiveUser`, duplicate-check de requests) em vez de virar 401/logout silencioso. Diagnóstico imediato.

## Arquivos alterados

- `src/server/repositories/users.ts` — verificação de `error` nas duas funções
- `src/server/repositories/users.test.ts` — novos testes (PGRST116→undefined, erro real→throw)
