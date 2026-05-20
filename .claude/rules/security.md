---
paths:
  - "src/app/api/**"
  - "src/server/**"
  - "src/lib/schemas.ts"
  - "src/proxy.ts"
---

## Segurança obrigatória

### SQL Injection
- Sempre Supabase ORM: `.from().select().eq()` — nunca interpolação de string em queries
- Parâmetros de RPC passados como objeto, nunca concatenados

### XSS
- Proibido `dangerouslySetInnerHTML`
- Campos de texto livre (`name`, `message`, `specialty`, textos longos): `.trim().max(N)` no Zod
- Nunca renderizar HTML vindo de input do usuário

### Brute Force
- Rate limiting por IP **antes** da lógica de negócio em todo endpoint de autenticação
- Implementação: Upstash Ratelimit ou fallback in-memory

### Clickjacking
- `next.config.ts` deve ter `X-Frame-Options: DENY` e `X-Content-Type-Options: nosniff` em `headers()`

### Mass Assignment
- Schema Zod define exatamente os campos aceitos — nunca `spread` de `req.body` direto no Supabase

### File Upload
- Validar `file.type.startsWith('audio/')` e `file.size <= MAX_BYTES` antes de processar

### Open Redirect
- Redirects com dados externos: sempre `new URL('/rota', req.url)` — nunca interpolar query params

### Auth
- JWT em cookie httpOnly `anamnese_auth` — nunca expor em localStorage ou resposta JSON
- Rotas protegidas validam role via `getServerUser()` de `src/server/services/session.ts`
- Roles válidas: `user` | `admin` | `master`

### Checklist Zod (obrigatório ao criar/editar qualquer schema)
- Texto livre: `.trim().max(500)` (ou limite apropriado)
- Email: `.email()`
- Numérico: `.int().min(0).max(N)`
- Nunca `.passthrough()` — `z.object` já rejeita campos extras por padrão
- Schemas centralizados em `src/lib/schemas.ts`
