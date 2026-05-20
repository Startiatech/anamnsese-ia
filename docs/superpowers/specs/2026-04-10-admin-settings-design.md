# Admin Settings Page — Design Spec

**Date:** 2026-04-10  
**Scope:** Página `/console/settings` para o papel `master` — perfil próprio + parâmetros do sistema.

---

## Contexto

A página existe no nav do console mas não tem implementação. O `master` é o super-admin único do sistema. O projeto está em fase invite-only, pré-Stripe.

Dois problemas resolvidos por esta página:
1. O master não tem como atualizar seu próprio nome ou senha via UI.
2. Os créditos padrão para novos usuários (`5`) estão hardcoded em `addUser` — impossível ajustar sem deploy.

---

## Escopo

### O que está dentro
- Formulário de perfil do master (nome + troca de senha opcional)
- Formulário de parâmetros do sistema (créditos padrão para novos usuários)
- Fix de rota: `consoleSettings` adicionado ao `ROUTES`, nav corrigido

### O que está fora (YAGNI)
- SMTP, integrações externas
- Configuração de planos (já existe `/console/plans`)
- Gestão de outros admins

---

## Arquitetura

```
src/app/(admin)/console/settings/
  page.tsx               Server Component — busca master user + default_credits
  settings-client.tsx    Client Component — dois formulários independentes

src/server/
  repositories/system-config.ts   SystemConfigRepository: get(key) / set(key, value)
  actions/settings.ts             updateMasterProfile / updateDefaultCredits
```

### Supabase — migration

```sql
create table system_config (
  key   text primary key,
  value text not null
);

insert into system_config (key, value) values ('default_credits', '5');
```

### `addUser` — remover hardcode

`users.ts`: substituir `credits_remaining: user.creditsRemaining ?? 5` por leitura de `system_config` onde `key = 'default_credits'`.

---

## Formulários

### 1. Perfil do master

| Campo | Validação |
|---|---|
| `name` | obrigatório, min 2 chars |
| `currentPassword` | obrigatório se `newPassword` preenchido |
| `newPassword` | opcional; se preenchido: min 6 chars |
| `confirmPassword` | deve ser igual a `newPassword` |

Regra: se qualquer campo de senha for preenchido, todos os três passam a ser obrigatórios.  
Se campos de senha vazios → só atualiza nome.

### 2. Parâmetros do sistema

| Campo | Validação |
|---|---|
| `defaultCredits` | inteiro, min 1, max 200 |

Lido de `system_config` onde `key = 'default_credits'`.  
Salvo como string (TEXT), lido e convertido para número na leitura.

---

## Server Actions

### `updateMasterProfile(userId, data)`
1. Se `newPassword` preenchido: busca hash atual, verifica `currentPassword` com `bcrypt.compare` — rejeita se errado
2. Valida que `confirmPassword === newPassword`
3. Atualiza `name` sempre
4. Se senha válida: atualiza `password_hash` com novo hash

### `updateDefaultCredits(value)`
1. Valida range 1–200
2. Chama `SystemConfigRepository.set('default_credits', String(value))`

---

## Testes (TDD)

### `system-config.test.ts`
- `get` retorna valor quando chave existe
- `get` retorna `null` quando chave não existe
- `set` salva / atualiza valor existente

### `settings.test.ts` — `// @vitest-environment node`
- `updateMasterProfile`: atualiza nome com sucesso
- `updateMasterProfile`: rejeita quando `currentPassword` está errado
- `updateMasterProfile`: rejeita quando `confirmPassword` não confere
- `updateMasterProfile`: não altera senha quando campos de senha estão vazios
- `updateDefaultCredits`: salva valor válido
- `updateDefaultCredits`: rejeita valor fora do range (0, 201)

---

## UI

Padrão do console:
- `PageHeader` com título "Configurações" e descrição
- `space-y-6` no wrapper
- Dois `Card` separados, cada um com seu `CardHeader` e `CardContent`
- Inputs com `border-b` apenas (padrão do projeto)
- `toast.promise` com `loading: 'Aguarde...'` em cada formulário
- `isSubmitting` desabilita botão durante envio

---

## Rotas

Adicionar ao `ROUTES`:
```ts
consoleSettings: '/console/settings',
```

Corrigir nav em `admin-layout-client.tsx`: substituir `href: '/console/settings'` por `href: ROUTES.consoleSettings`.
