# Design: Identidade Visual, Landing Page, Login e Auth

**Data:** 2026-03-26
**Abordagem:** Outside-in (Landing → Login → Auth → Admin → Histórico)

---

## 1. Identidade Visual

### Paleta de Cores (CSS Variables — globals.css)

| Token | Valor | Uso |
|---|---|---|
| `--background` | `#0F172A` (slate-950) | Fundo global |
| `--surface` | `#1E293B` (slate-800) | Cards, sidebar, topbar |
| `--surface-2` | `#334155` (slate-700) | Inputs, hover states |
| `--primary` | `#7C3AED` (violet-600) | Botões, links, foco |
| `--primary-glow` | `#8B5CF6` (violet-500) | Hover, glow |
| `--accent` | `#06B6D4` (cyan-500) | Badges, destaques |
| `--foreground` | `#F1F5F9` (slate-100) | Texto principal |
| `--muted-foreground` | `#94A3B8` (slate-400) | Texto secundário |
| `--border` | `rgba(255,255,255,0.05)` | Bordas sutis |
| `--destructive` | `#EF4444` (red-500) | Erros |

### Tipografia
- Fonte: `Inter` (padrão Next.js)
- Títulos: `font-semibold`
- Labels: `font-medium`

### Estilo de Componentes (híbrido clean + glow sutil)
- Border radius: `0.75rem`
- Cards: `bg-[--surface] border border-white/5 shadow-lg`
- Botão primário: `bg-violet-600 hover:bg-violet-500` + glow `shadow-[0_0_20px_rgba(124,58,237,0.3)]` no hover
- Inputs: `bg-[--surface-2] border-white/10 focus:border-violet-500 focus:ring-violet-500/20`
- Sidebar/Topbar: `bg-[--surface] border-white/5`
- Densidade equilibrada: nem vazio nem sufocado

---

## 2. Landing Page (`/`)

**Objetivo:** Converter visitante desconhecido → solicitação de acesso (sem cadastro self-service)

### Seções
1. **Hero** — tagline forte, subtext, 2 CTAs: "Solicitar Acesso" + "Já tenho acesso" (→ login)
2. **Como funciona** — 3 passos: Grave o atendimento → IA transcreve e estrutura → Anamnese pronta
3. **Benefícios** — 3-4 cards: Economia de tempo, Precisão clínica, Segurança dos dados, Exportação PDF/DOCX
4. **CTA final** — repetição do "Solicitar Acesso"
5. **Footer** simples — nome do produto, links básicos

### Formulário "Solicitar Acesso"
- Campos: Nome completo, Email, Especialidade médica, Mensagem opcional
- Submissão salva em localStorage por enquanto (migra para DB depois)
- Confirmação visual após envio

---

## 3. Página de Login (`/login`)

- Email + senha
- Sem cadastro self-service — só emails cadastrados pelo admin funcionam
- Erro genérico em credenciais inválidas ("Email ou senha incorretos")
- Redirect após login → `/dashboard`

---

## 4. Autenticação (JWT próprio)

### Estratégia
- JWT assinado com `NEXTAUTH_SECRET` (variável de ambiente)
- Usuários armazenados em `src/lib/users.ts` como array tipado (migra para Supabase depois)
- Cookie `httpOnly` com o token (não exposto ao JS do browser)
- Middleware Next.js (`middleware.ts`) protege todas as rotas `/(app)/*`
- Rotas públicas: `/`, `/login`, `/solicitar-acesso`

### Fluxo
1. POST `/api/auth/login` → valida credenciais → gera JWT → seta cookie
2. POST `/api/auth/logout` → limpa cookie → redirect `/login`
3. `middleware.ts` → verifica cookie em rotas protegidas → redireciona se inválido

---

## 5. Painel Admin (`/admin`)

- Rota protegida por role `admin` no JWT payload
- Lista de solicitações de acesso (do localStorage por enquanto)
- Ação: "Aprovar" → cria usuário em `src/lib/users.ts` + gera senha provisória exibida na tela
- Sem email automático por enquanto — admin copia e envia manualmente

---

## 6. Ordem de Implementação

1. Estilização global (globals.css + tailwind.config + componentes shadcn)
2. Landing page
3. Página de login
4. Sistema JWT (API routes + middleware)
5. Painel admin
6. Página `/historico`
