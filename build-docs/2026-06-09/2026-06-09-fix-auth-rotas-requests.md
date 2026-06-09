# Correção de autorização nas rotas de solicitações de acesso

**Data:** 2026-06-09
**Tipo:** `fix(security)`
**Origem:** auditoria de segurança dirigida (itens críticos 1 e 2)

## Contexto

Auditoria identificou duas falhas de autorização nas rotas de *access requests*, que são o gatilho do modelo invite-only do produto.

## Vulnerabilidades corrigidas

### 1. `PATCH /api/requests/[id]` — escalonamento de privilégio (CRÍTICO)
O handler alterava o status de qualquer solicitação (`pending`→`approved`) **sem verificar role**. O proxy só exige `admin|master` em `/console`, então qualquer usuário autenticado com role `user` alcançava o handler e podia autoaprovar acessos, furando o invite-only.

**Correção:** `getServerUser()` + checagem `admin|master` no início do PATCH (401 sem sessão, 403 sem role).

### 2. `GET /api/requests` (sem query `email`) — vazamento de PII (CRÍTICO)
O branch que retorna `listRequests()` (nome, email, telefone, mensagem de todos os solicitantes) era alcançável sem autenticação, pois o proxy libera `/api/requests` como rota pública para o formulário.

**Correção:** lookup por `?email=` permanece público (necessário ao formulário de duplicidade); o branch de listagem completa passa a exigir `admin|master` (401/403).

## Arquivos alterados

- `src/app/api/requests/[id]/route.ts` — auth no PATCH
- `src/app/api/requests/route.ts` — auth no branch de listagem do GET
- `src/app/api/requests/[id]/route.test.ts` — novo (RED→GREEN)
- `src/app/api/requests/route.test.ts` — novo (RED→GREEN)

## Validação

- Testes unitários por rota cobrindo: 401 sem sessão, 403 role `user`, 200 `admin`/`master`, 400 status inválido, 404 não encontrado, e lookup público por email preservado.

## Pendências relacionadas (não neste commit)

- Item 3 (alto): senha provisória com `Math.random` em `add-user-modal.tsx` e `console-dashboard-client.tsx`.
- Item 6 (médio): `findUserByEmail`/`findUserById` engolem `error` do Supabase (mascarou banco pausado como 401).
