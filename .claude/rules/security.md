---
paths:
  - "src/app/api/**"
  - "src/server/**"
  - "src/lib/schemas.ts"
  - "src/proxy.ts"
---

## Segurança obrigatória

### IDOR / Autorização por recurso (vetor nº 1 do projeto)
- O cliente Supabase usa `service_role`, que **bypassa RLS** — toda autorização é responsabilidade do código
- Toda query que envolve recurso de usuário (paciente, consulta, anamnese) DEVE filtrar pelo `user.id` de `getServerUser()` — nunca confiar em `userId`/`patientId`/IDs vindos do body, query params ou formData
- Ao buscar por ID vindo do cliente: sempre `.eq('id', id).eq('user_id', user.id)` (ou validação equivalente de ownership)
- Rotas admin/master: validar role explicitamente antes de qualquer operação cross-tenant

### CSRF
- Auth é por cookie → API routes **mutáveis** (POST/PUT/PATCH/DELETE fora de Server Actions) devem validar o header `Origin` contra a origem da aplicação
- Cookie `anamnese_auth`: `httpOnly` + `Secure` + `SameSite=Lax` (mínimo)
- Server Actions já têm proteção nativa do Next — a regra vale para API routes

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
- Login: mensagem de erro **idêntica** para "email não existe" e "senha errada" — evita enumeração de usuários (relevante: produto é invite-only)

### Endpoints de IA (custo financeiro)
- `/api/transcription`, `/api/anamnesis`, `/api/refine`: verificar **no servidor, via banco** o saldo de créditos/cotas do atendimento (ex: 2 áudios + 3 refinamentos) **antes** da chamada externa — nunca confiar no contador do cliente
- Decremento de cota/crédito: atômico via RPC, nunca get+set
- Rate limit por usuário nesses endpoints como segunda camada (mesmo com créditos, evita burst/abuso acidental)

### Security headers
- `next.config.ts` deve ter em `headers()`: `X-Frame-Options: DENY` · `X-Content-Type-Options: nosniff` · `Referrer-Policy: strict-origin-when-cross-origin` · `Permissions-Policy` restritiva (liberar apenas `microphone=(self)` pelo fluxo de áudio)

### Mass Assignment
- Schema Zod define exatamente os campos aceitos — nunca `spread` de `req.body` direto no Supabase

### File Upload
- Validar `file.type.startsWith('audio/')` e `file.size <= MAX_BYTES` antes de processar
- `file.type` é declarado pelo cliente (spoofável) — é primeira camada; nunca servir o arquivo de volta confiando nesse content-type, e em fluxo crítico validar magic bytes

### Open Redirect
- Redirects com dados externos: sempre `new URL('/rota', req.url)` — nunca interpolar query params

### Auth
- JWT em cookie httpOnly `anamnese_auth` — nunca expor em localStorage ou resposta JSON
- JWT: expiração (`exp`) obrigatória; verificação com `jose` deve fixar o algoritmo esperado (`algorithms: ['HS256']` ou equivalente) — nunca aceitar algoritmo do header
- Cookie: `httpOnly` + `Secure` + `SameSite`
- Rotas protegidas validam role via `getServerUser()` de `src/server/services/session.ts`
- Roles válidas: `user` | `admin` | `master`

### Geração de segredos
- Senhas provisórias, tokens e qualquer valor de segurança: **somente CSPRNG** (`crypto.getRandomValues` / `crypto.randomBytes` / `crypto.randomUUID`) — `Math.random` proibido
- Idealmente gerar server-side, nunca no client

### PII e dados de saúde em logs (LGPD)
- **Proibido** logar transcrição, anamnese, nome/CPF/dados clínicos de paciente em `console.*`, logs de erro ou mensagens de exceção
- Em erros de endpoints de IA: logar apenas IDs e metadados (userId, requestId, status), nunca o conteúdo
- Respostas de erro ao cliente: genéricas, sem stack trace nem detalhes internos

### Checklist Zod (obrigatório ao criar/editar qualquer schema)
- Texto livre: `.trim().max(500)` (ou limite apropriado)
- Email: `.email()`
- Numérico: `.int().min(0).max(N)`
- Nunca `.passthrough()` — o padrão do `z.object` é **strip** (remove campos extras silenciosamente), o que já protege contra mass assignment; usar `.strict()` quando rejeitar explicitamente for desejado
- Schemas centralizados em `src/lib/schemas.ts`
