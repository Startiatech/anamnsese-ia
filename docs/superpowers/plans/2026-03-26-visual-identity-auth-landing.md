# Visual Identity, Landing Page, Login & Auth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar identidade visual (paleta violet/cyan em fundo slate-950), criar landing page pública, página de login e sistema de autenticação JWT com proteção de rotas e painel admin invite-only.

**Architecture:** Outside-in — estilização global primeiro, depois landing, login, auth JWT (jose + httpOnly cookie), middleware Next.js protegendo `/(app)/*`, painel admin com role `admin` no payload JWT. Usuários armazenados em `src/lib/users.ts` (migra para Supabase depois). Solicitações de acesso salvas em localStorage.

**Tech Stack:** Next.js 14 App Router · TypeScript · Tailwind CSS v3 · shadcn/ui · `jose` (JWT) · Vitest + React Testing Library

---

## File Map

**Modificar:**
- `src/app/globals.css` — nova paleta oklch (slate-950 bg, violet primary, cyan accent)
- `src/app/layout.tsx` — classe `dark` no `<html>` para ativar .dark vars
- `src/app/page.tsx` — substituir redirect por landing page
- `src/components/ui/button.tsx` — variante default com glow violet
- `src/components/ui/input.tsx` — estilo surface-2 com focus violet
- `src/components/ui/card.tsx` — estilo surface com border sutil
- `src/components/layout/Topbar.tsx` — estilo surface + logout real
- `src/components/layout/Sidebar.tsx` — estilo surface + active state violet

**Criar:**
- `src/lib/auth.ts` — funções JWT: `signToken`, `verifyToken`, `hashPassword`, `comparePassword`
- `src/lib/users.ts` — store de usuários em memória (array tipado)
- `src/app/login/page.tsx` — página de login
- `src/app/solicitar-acesso/page.tsx` — formulário de solicitação
- `src/app/api/auth/login/route.ts` — POST login → JWT cookie
- `src/app/api/auth/logout/route.ts` — POST logout → limpa cookie
- `src/app/admin/page.tsx` — painel admin (lista solicitações, cria usuários)
- `src/middleware.ts` — protege `/(app)/*` e `/admin` rotas
- `src/components/landing/LandingNavbar.tsx` — navbar pública
- `src/components/landing/HeroSection.tsx` — hero com CTAs
- `src/components/landing/HowItWorks.tsx` — 3 passos
- `src/components/landing/BenefitsSection.tsx` — 4 benefícios
- `src/components/landing/CTASection.tsx` — CTA final
- `src/components/landing/LandingFooter.tsx` — footer simples

---

## Task 1: Instalar dependência `jose`

**Files:**
- Modify: `package.json` (via npm)

- [ ] **Step 1: Instalar jose**

```bash
npm install jose
```

Expected output: `added 1 package`

- [ ] **Step 2: Verificar instalação**

```bash
node -e "require('jose'); console.log('jose ok')"
```

Expected: `jose ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add jose for JWT authentication"
```

---

## Task 2: Paleta de cores global

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Substituir globals.css completo**

Substitua todo o conteúdo de `src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
}

@layer base {
  :root {
    /* Base — slate-950 background (dark-only theme, sem toggle) */
    --background: oklch(0.129 0.042 264.695);
    --foreground: oklch(0.952 0.012 264.695);

    /* Surfaces */
    --card: oklch(0.208 0.042 264.695);
    --card-foreground: oklch(0.952 0.012 264.695);
    --popover: oklch(0.208 0.042 264.695);
    --popover-foreground: oklch(0.952 0.012 264.695);

    /* Primary — violet-600 */
    --primary: oklch(0.541 0.281 293.009);
    --primary-foreground: oklch(0.985 0 0);

    /* Secondary — slate-800 */
    --secondary: oklch(0.279 0.041 264.695);
    --secondary-foreground: oklch(0.952 0.012 264.695);

    /* Muted */
    --muted: oklch(0.279 0.041 264.695);
    --muted-foreground: oklch(0.704 0.04 264.695);

    /* Accent — cyan-500 */
    --accent: oklch(0.715 0.143 215.221);
    --accent-foreground: oklch(0.129 0.042 264.695);

    /* Destructive */
    --destructive: oklch(0.637 0.237 25.331);
    --destructive-foreground: oklch(0.985 0 0);

    /* Borders & inputs */
    --border: oklch(1 0 0 / 8%);
    --input: oklch(0.279 0.041 264.695);
    --ring: oklch(0.541 0.281 293.009);

    /* Charts — violet/cyan scale */
    --chart-1: oklch(0.541 0.281 293.009);
    --chart-2: oklch(0.715 0.143 215.221);
    --chart-3: oklch(0.606 0.25 292.717);
    --chart-4: oklch(0.372 0.044 264.695);
    --chart-5: oklch(0.279 0.041 264.695);

    --radius: 0.75rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

- [ ] **Step 2: Adicionar classe `dark` no html em layout.tsx**

Em `src/app/layout.tsx`, altere a linha `<html lang="pt-BR">` para:

```tsx
<html lang="pt-BR" className="dark">
```

- [ ] **Step 3: Rodar dev e verificar fundo escuro**

```bash
npm run dev
```

Abra `http://localhost:3000` — fundo deve ser slate-950 (azul-escuro quase preto). Se ainda estiver branco, force hard refresh (Ctrl+Shift+R).

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat: apply dark violet/cyan brand palette"
```

---

## Task 3: Estilizar componentes shadcn

**Files:**
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/input.tsx`
- Modify: `src/components/ui/card.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/Topbar.tsx`

- [ ] **Step 1: Atualizar Button — variante default com glow violet**

Em `src/components/ui/button.tsx`, substitua a linha da variante `default`:

```tsx
default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_0_0_rgba(124,58,237,0)] hover:shadow-[0_0_20px_rgba(124,58,237,0.35)] transition-shadow [a]:hover:bg-primary/80",
```

- [ ] **Step 2: Atualizar Input — fundo surface com focus violet**

Em `src/components/ui/input.tsx`, substitua a className do input:

```tsx
"flex h-10 w-full rounded-md border border-border bg-input px-3 py-2 text-base text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
```

- [ ] **Step 3: Atualizar Card — surface com borda sutil**

Em `src/components/ui/card.tsx`, substitua a className do Card:

```tsx
"rounded-xl border border-border bg-card text-card-foreground shadow-lg",
```

- [ ] **Step 4: Atualizar Sidebar — surface com active state violet**

Em `src/components/layout/Sidebar.tsx`, substitua a className do `<aside>`:

```tsx
<aside className="flex flex-col w-56 h-full bg-card border-r border-border">
```

E o estado active do Link:

```tsx
active
  ? 'bg-primary/15 text-primary border border-primary/20'
  : 'text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent'
```

- [ ] **Step 5: Atualizar Topbar — surface com borda sutil**

Em `src/components/layout/Topbar.tsx`, substitua a className do `<header>`:

```tsx
<header className="h-14 border-b border-border bg-card fixed top-0 left-0 right-0 z-40 flex items-center px-4 gap-4">
```

E o logo com cor violet:

```tsx
<span className="font-bold text-base tracking-tight text-primary">
  Anamnese IA
</span>
```

- [ ] **Step 6: Verificar visualmente no browser**

Navegue para `http://localhost:3000/dashboard` e confirme:
- Sidebar/Topbar com fundo card (slate-800)
- Item ativo com bg violet translúcido e texto violet
- Logo violeta

- [ ] **Step 7: Rodar testes**

```bash
npm test
```

Expected: todos os testes passando (51+). Se algum falhar por className alterado, ajuste o teste para não checar classes internas de componentes UI.

- [ ] **Step 8: Commit**

```bash
git add src/components/ui/button.tsx src/components/ui/input.tsx src/components/ui/card.tsx src/components/layout/Sidebar.tsx src/components/layout/Topbar.tsx
git commit -m "feat: style shadcn components with violet/cyan brand theme"
```

---

## Task 4: Biblioteca de autenticação JWT

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/lib/users.ts`

- [ ] **Step 1: Criar src/lib/users.ts**

```typescript
// src/lib/users.ts
// Store de usuários em memória — migra para Supabase depois.
// Senhas são armazenadas como hash bcrypt-like usando Web Crypto (via jose).

export type UserRole = 'user' | 'admin'

export interface StoredUser {
  id: string
  name: string
  email: string
  passwordHash: string
  role: UserRole
  specialty?: string
  createdAt: string
}

// Usuário admin padrão — senha definida via env ADMIN_PASSWORD_HASH
// Para gerar o hash, use a rota POST /api/auth/hash-password em dev
const USERS: StoredUser[] = [
  {
    id: 'admin-1',
    name: 'Admin',
    email: process.env.ADMIN_EMAIL ?? 'admin@anamnese.ai',
    passwordHash: process.env.ADMIN_PASSWORD_HASH ?? '',
    role: 'admin',
    createdAt: new Date().toISOString(),
  },
]

export function findUserByEmail(email: string): StoredUser | undefined {
  return USERS.find((u) => u.email.toLowerCase() === email.toLowerCase())
}

export function findUserById(id: string): StoredUser | undefined {
  return USERS.find((u) => u.id === id)
}

export function addUser(user: StoredUser): void {
  USERS.push(user)
}

export function listUsers(): StoredUser[] {
  return USERS.filter((u) => u.role !== 'admin')
}
```

- [ ] **Step 2: Criar src/lib/auth.ts**

```typescript
// src/lib/auth.ts
import { SignJWT, jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'dev-secret-change-in-production'
)

const COOKIE_NAME = 'anamnese_auth'
const TOKEN_EXPIRY = '7d'

export interface JWTPayload {
  sub: string       // user id
  email: string
  name: string
  role: 'user' | 'admin'
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}

// Hash simples usando Web Crypto (SHA-256 + salt) — suficiente para MVP
// Em produção usar bcrypt/argon2 via API route (não Edge)
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join('')
  const encoder = new TextEncoder()
  const data = encoder.encode(saltHex + password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `${saltHex}:${hashHex}`
}

export async function comparePassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const encoder = new TextEncoder()
  const data = encoder.encode(salt + password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return hashHex === hash
}

export { COOKIE_NAME }
```

- [ ] **Step 3: Adicionar variáveis de ambiente**

Crie/atualize `.env.local`:

```bash
JWT_SECRET=sua-chave-secreta-aqui-min-32-chars
ADMIN_EMAIL=seu@email.com
ADMIN_PASSWORD_HASH=
```

O `ADMIN_PASSWORD_HASH` será preenchido na Task 6 (rota de setup).

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth.ts src/lib/users.ts .env.local
git commit -m "feat: add JWT auth library and user store"
```

---

## Task 5: API Routes de autenticação

**Files:**
- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/logout/route.ts`
- Create: `src/app/api/auth/setup/route.ts` (helper dev para gerar hash)

- [ ] **Step 1: Criar rota POST /api/auth/login**

```typescript
// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { findUserByEmail } from '@/lib/users'
import { comparePassword, signToken, COOKIE_NAME } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 })
  }

  const user = findUserByEmail(email)

  if (!user) {
    return NextResponse.json({ error: 'Email ou senha incorretos' }, { status: 401 })
  }

  const valid = await comparePassword(password, user.passwordHash)

  if (!valid) {
    return NextResponse.json({ error: 'Email ou senha incorretos' }, { status: 401 })
  }

  const token = await signToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  })

  const response = NextResponse.json({ ok: true, role: user.role })

  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 dias
    path: '/',
  })

  return response
}
```

- [ ] **Step 2: Criar rota POST /api/auth/logout**

```typescript
// src/app/api/auth/logout/route.ts
import { NextResponse } from 'next/server'
import { COOKIE_NAME } from '@/lib/auth'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(COOKIE_NAME)
  return response
}
```

- [ ] **Step 3: Criar rota de setup (só para dev — gerar hash da senha admin)**

```typescript
// src/app/api/auth/setup/route.ts
// REMOVER EM PRODUÇÃO — usado só para gerar o hash inicial da senha admin
import { NextRequest, NextResponse } from 'next/server'
import { hashPassword } from '@/lib/auth'

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }
  const { password } = await req.json()
  const hash = await hashPassword(password)
  return NextResponse.json({ hash })
}
```

- [ ] **Step 4: Gerar hash da senha admin**

Com o servidor rodando (`npm run dev`), execute no terminal:

```bash
curl -X POST http://localhost:3000/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{"password":"sua-senha-admin-aqui"}'
```

Copie o valor `hash` retornado e cole no `.env.local`:

```bash
ADMIN_PASSWORD_HASH=<hash-copiado-aqui>
```

Reinicie o servidor (`Ctrl+C` e `npm run dev` novamente).

- [ ] **Step 5: Testar login via curl**

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"seu@email.com","password":"sua-senha-admin-aqui"}' \
  -v 2>&1 | grep -E "Set-Cookie|200|401"
```

Expected: `< HTTP/1.1 200` e `Set-Cookie: anamnese_auth=...`

- [ ] **Step 6: Commit**

```bash
git add src/app/api/auth/
git commit -m "feat: add login/logout API routes with JWT cookie"
```

---

## Task 6: Middleware de proteção de rotas

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Criar middleware.ts na raiz de src/**

```typescript
// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'

const PUBLIC_PATHS = ['/', '/login', '/solicitar-acesso']
const ADMIN_PATHS = ['/admin']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Rotas públicas — sem verificação
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  // Ignora assets e API routes de auth
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  const token = req.cookies.get(COOKIE_NAME)?.value
  const payload = token ? await verifyToken(token) : null

  if (!payload) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Rotas admin — exige role admin
  if (ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    if (payload.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 2: Testar proteção**

Com o servidor rodando, acesse `http://localhost:3000/dashboard` sem estar logado.
Expected: redirect para `/login`.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add Next.js middleware for route protection"
```

---

## Task 7: Página de login

**Files:**
- Create: `src/app/login/page.tsx`

- [ ] **Step 1: Criar src/app/login/page.tsx**

```tsx
// src/app/login/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Erro ao fazer login')
        return
      }

      const { role } = await res.json()
      router.push(role === 'admin' ? '/admin' : '/dashboard')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-2xl font-bold text-primary tracking-tight">Anamnese IA</span>
          <p className="text-muted-foreground text-sm mt-1">Acesso à plataforma</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Entrar</CardTitle>
            <CardDescription>Use as credenciais enviadas pelo administrador</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="email">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="password">
                  Senha
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <a
                href="/solicitar-acesso"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Não tem acesso? Solicitar
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar no browser**

Acesse `http://localhost:3000/login`. Deve exibir card centralizado com fundo slate-950, logo violet, formulário com inputs escuros.

- [ ] **Step 3: Testar login com credenciais admin**

Preencha email/senha admin e submeta. Expected: redirect para `/admin` (que ainda não existe — vai mostrar 404, normal por enquanto).

- [ ] **Step 4: Commit**

```bash
git add src/app/login/
git commit -m "feat: add login page with JWT authentication"
```

---

## Task 8: Conectar AppContext ao JWT + logout real

**Files:**
- Modify: `src/context/AppContext.tsx`
- Modify: `src/components/layout/Topbar.tsx`

- [ ] **Step 1: Ler AppContext atual**

Leia `src/context/AppContext.tsx` para entender a estrutura do mock user.

- [ ] **Step 2: Adicionar função logout ao AppContext**

No `AppContext.tsx`, adicione a função `logout` ao contexto:

```typescript
// Adicionar ao tipo do contexto:
logout: () => Promise<void>

// Implementação no provider:
async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' })
  window.location.href = '/login'
}
```

Exponha `logout` no valor do contexto.

- [ ] **Step 3: Atualizar Topbar para usar logout real**

Em `src/components/layout/Topbar.tsx`, substitua o `onClick` do item "Sair":

```tsx
import { useApp } from '@/context/AppContext'

// No componente:
const { user, logout } = useApp()

// No DropdownMenuItem de Sair:
<DropdownMenuItem
  className="text-destructive focus:text-destructive"
  onClick={logout}
>
  Sair
</DropdownMenuItem>
```

- [ ] **Step 4: Rodar testes**

```bash
npm test
```

Expected: todos passando. Se algum teste de AppContext falhar por falta de `logout`, adicione o mock `logout: vi.fn()` no teste.

- [ ] **Step 5: Commit**

```bash
git add src/context/AppContext.tsx src/components/layout/Topbar.tsx
git commit -m "feat: connect logout to JWT auth, remove mock logout"
```

---

## Task 9: Página de solicitação de acesso

**Files:**
- Create: `src/app/solicitar-acesso/page.tsx`

- [ ] **Step 1: Criar src/app/solicitar-acesso/page.tsx**

```tsx
// src/app/solicitar-acesso/page.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { CheckCircle } from 'lucide-react'

interface AccessRequest {
  id: string
  name: string
  email: string
  specialty: string
  message: string
  createdAt: string
  status: 'pending' | 'approved'
}

export default function SolicitarAcessoPage() {
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    specialty: '',
    message: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    // Salva em localStorage por enquanto
    const requests: AccessRequest[] = JSON.parse(
      localStorage.getItem('access_requests') ?? '[]'
    )
    const newRequest: AccessRequest = {
      id: crypto.randomUUID(),
      ...form,
      createdAt: new Date().toISOString(),
      status: 'pending',
    }
    requests.push(newRequest)
    localStorage.setItem('access_requests', JSON.stringify(requests))

    setLoading(false)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4">
          <CheckCircle className="h-12 w-12 text-accent mx-auto" />
          <h1 className="text-2xl font-semibold text-foreground">Solicitação enviada!</h1>
          <p className="text-muted-foreground max-w-sm">
            Recebemos sua solicitação. Em breve entraremos em contato com suas credenciais de acesso.
          </p>
          <a href="/" className="text-sm text-primary hover:underline">
            Voltar ao início
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <a href="/" className="text-2xl font-bold text-primary tracking-tight">
            Anamnese IA
          </a>
          <p className="text-muted-foreground text-sm mt-1">Solicitar acesso à plataforma</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Solicitar acesso</CardTitle>
            <CardDescription>
              Preencha o formulário e entraremos em contato em até 24 horas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="name">Nome completo</label>
                <Input id="name" name="name" placeholder="Dr. João Silva" value={form.name} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="email">Email</label>
                <Input id="email" name="email" type="email" placeholder="seu@email.com" value={form.email} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="specialty">Especialidade</label>
                <Input id="specialty" name="specialty" placeholder="Clínica Geral, Cardiologia..." value={form.specialty} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="message">Mensagem (opcional)</label>
                <textarea
                  id="message"
                  name="message"
                  placeholder="Conte um pouco sobre seu contexto de uso..."
                  value={form.message}
                  onChange={handleChange}
                  className="flex min-h-[80px] w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                />
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? 'Enviando...' : 'Solicitar acesso'}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <a href="/login" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Já tenho acesso — Entrar
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar no browser**

Acesse `http://localhost:3000/solicitar-acesso`. Preencha e submeta — deve mostrar tela de confirmação com ícone cyan.

- [ ] **Step 3: Commit**

```bash
git add src/app/solicitar-acesso/
git commit -m "feat: add access request page with localStorage persistence"
```

---

## Task 10: Painel Admin

**Files:**
- Create: `src/app/admin/page.tsx`

- [ ] **Step 1: Criar src/app/admin/page.tsx**

```tsx
// src/app/admin/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

interface AccessRequest {
  id: string
  name: string
  email: string
  specialty: string
  message: string
  createdAt: string
  status: 'pending' | 'approved'
}

interface NewUser {
  email: string
  tempPassword: string
}

export default function AdminPage() {
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [approvedUser, setApprovedUser] = useState<NewUser | null>(null)
  const [newUserForm, setNewUserForm] = useState({ name: '', email: '', specialty: '' })
  const [createdUser, setCreatedUser] = useState<NewUser | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('access_requests') ?? '[]')
    setRequests(stored)
  }, [])

  async function handleApprove(request: AccessRequest) {
    setLoading(true)
    const tempPassword = Math.random().toString(36).slice(2, 10)

    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: request.name,
        email: request.email,
        specialty: request.specialty,
        password: tempPassword,
      }),
    })

    if (res.ok) {
      const updated = requests.map((r) =>
        r.id === request.id ? { ...r, status: 'approved' as const } : r
      )
      setRequests(updated)
      localStorage.setItem('access_requests', JSON.stringify(updated))
      setApprovedUser({ email: request.email, tempPassword })
    }
    setLoading(false)
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const tempPassword = Math.random().toString(36).slice(2, 10)

    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newUserForm, password: tempPassword }),
    })

    if (res.ok) {
      setCreatedUser({ email: newUserForm.email, tempPassword })
      setNewUserForm({ name: '', email: '', specialty: '' })
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">Painel Admin</h1>
          <a href="/dashboard" className="text-sm text-muted-foreground hover:text-primary">
            Ir para o app →
          </a>
        </div>

        {/* Criar usuário manualmente */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Criar usuário manualmente</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateUser} className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1 flex-1 min-w-[160px]">
                <label className="text-xs text-muted-foreground">Nome</label>
                <Input placeholder="Dr. Ana Lima" value={newUserForm.name} onChange={(e) => setNewUserForm((p) => ({ ...p, name: e.target.value }))} required />
              </div>
              <div className="space-y-1 flex-1 min-w-[160px]">
                <label className="text-xs text-muted-foreground">Email</label>
                <Input type="email" placeholder="ana@clinica.com" value={newUserForm.email} onChange={(e) => setNewUserForm((p) => ({ ...p, email: e.target.value }))} required />
              </div>
              <div className="space-y-1 flex-1 min-w-[120px]">
                <label className="text-xs text-muted-foreground">Especialidade</label>
                <Input placeholder="Cardiologia" value={newUserForm.specialty} onChange={(e) => setNewUserForm((p) => ({ ...p, specialty: e.target.value }))} required />
              </div>
              <Button type="submit" disabled={loading}>Criar</Button>
            </form>

            {createdUser && (
              <div className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm">
                <p className="font-medium text-primary">Usuário criado!</p>
                <p className="text-muted-foreground">Email: <span className="text-foreground">{createdUser.email}</span></p>
                <p className="text-muted-foreground">Senha provisória: <span className="text-foreground font-mono">{createdUser.tempPassword}</span></p>
                <p className="text-xs text-muted-foreground mt-1">Copie e envie manualmente para o usuário.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Solicitações pendentes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Solicitações de acesso{' '}
              <Badge variant="secondary">{requests.filter((r) => r.status === 'pending').length} pendentes</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {requests.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma solicitação ainda.</p>
            )}
            {requests.map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-4 p-3 rounded-lg border border-border">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-sm font-medium text-foreground">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.email} · {r.specialty}</p>
                  {r.message && <p className="text-xs text-muted-foreground italic">{r.message}</p>}
                </div>
                <div className="shrink-0">
                  {r.status === 'approved' ? (
                    <Badge className="bg-accent/20 text-accent border-accent/30">Aprovado</Badge>
                  ) : (
                    <Button size="sm" onClick={() => handleApprove(r)} disabled={loading}>
                      Aprovar
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {approvedUser && (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm">
                <p className="font-medium text-primary">Credenciais geradas!</p>
                <p className="text-muted-foreground">Email: <span className="text-foreground">{approvedUser.email}</span></p>
                <p className="text-muted-foreground">Senha provisória: <span className="text-foreground font-mono">{approvedUser.tempPassword}</span></p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Criar API route para criar usuário**

```typescript
// src/app/api/admin/create-user/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, hashPassword, COOKIE_NAME } from '@/lib/auth'
import { addUser, findUserByEmail } from '@/lib/users'

export async function POST(req: NextRequest) {
  // Verificar se é admin
  const token = req.cookies.get(COOKIE_NAME)?.value
  const payload = token ? await verifyToken(token) : null

  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { name, email, specialty, password } = await req.json()

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
  }

  if (findUserByEmail(email)) {
    return NextResponse.json({ error: 'Email já cadastrado' }, { status: 409 })
  }

  const passwordHash = await hashPassword(password)

  addUser({
    id: crypto.randomUUID(),
    name,
    email,
    passwordHash,
    role: 'user',
    specialty,
    createdAt: new Date().toISOString(),
  })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Verificar painel admin**

Faça login como admin e acesse `http://localhost:3000/admin`. Crie um usuário de teste e confirme que as credenciais aparecem na tela.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/ src/app/api/admin/
git commit -m "feat: add admin panel with user creation and access request approval"
```

---

## Task 11: Landing Page

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/components/landing/LandingNavbar.tsx`
- Create: `src/components/landing/HeroSection.tsx`
- Create: `src/components/landing/HowItWorks.tsx`
- Create: `src/components/landing/BenefitsSection.tsx`
- Create: `src/components/landing/CTASection.tsx`
- Create: `src/components/landing/LandingFooter.tsx`

- [ ] **Step 1: Criar LandingNavbar**

```tsx
// src/components/landing/LandingNavbar.tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function LandingNavbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-border bg-background/80 backdrop-blur-sm flex items-center px-6">
      <span className="font-bold text-lg text-primary tracking-tight">Anamnese IA</span>
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        <Link href="/solicitar-acesso" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Solicitar acesso
        </Link>
        <Button asChild size="sm">
          <Link href="/login">Entrar</Link>
        </Button>
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Criar HeroSection**

```tsx
// src/components/landing/HeroSection.tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkles } from 'lucide-react'

export function HeroSection() {
  return (
    <section className="min-h-screen flex items-center justify-center px-6 pt-16">
      <div className="max-w-3xl mx-auto text-center space-y-6">
        <Badge className="bg-primary/10 text-primary border-primary/20 px-3 py-1 text-xs font-medium">
          <Sparkles className="h-3 w-3 mr-1.5 inline" />
          Powered by IA
        </Badge>

        <h1 className="text-4xl md:text-6xl font-bold text-foreground leading-tight">
          Anamnese clínica{' '}
          <span className="text-primary">gerada por IA</span>{' '}
          em segundos
        </h1>

        <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Grave o atendimento, a IA transcreve e estrutura automaticamente.
          Economize tempo, aumente a precisão e foque no que importa: o paciente.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button asChild size="lg" className="px-8">
            <Link href="/solicitar-acesso">Solicitar acesso gratuito</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="px-8">
            <Link href="/login">Já tenho acesso</Link>
          </Button>
        </div>

        {/* Glow decorativo */}
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/5 rounded-full blur-[120px]" />
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Criar HowItWorks**

```tsx
// src/components/landing/HowItWorks.tsx
import { Mic, Cpu, FileText } from 'lucide-react'

const STEPS = [
  {
    icon: Mic,
    number: '01',
    title: 'Grave o atendimento',
    description: 'Use o microfone direto na plataforma. Converse naturalmente com o paciente enquanto a IA escuta.',
  },
  {
    icon: Cpu,
    number: '02',
    title: 'IA transcreve e estrutura',
    description: 'O áudio é transcrito por Whisper e processado pelo Claude para identificar queixas, histórico e dados clínicos.',
  },
  {
    icon: FileText,
    number: '03',
    title: 'Anamnese pronta',
    description: 'Revise o documento gerado, ajuste se necessário e exporte em PDF ou DOCX para o prontuário.',
  },
]

export function HowItWorks() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-foreground">Como funciona</h2>
          <p className="text-muted-foreground mt-2">Três passos do atendimento à anamnese estruturada</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {STEPS.map(({ icon: Icon, number, title, description }) => (
            <div key={number} className="relative space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <span className="text-3xl font-bold text-border">{number}</span>
              </div>
              <h3 className="text-lg font-semibold text-foreground">{title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Criar BenefitsSection**

```tsx
// src/components/landing/BenefitsSection.tsx
import { Clock, Target, Shield, Download } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const BENEFITS = [
  {
    icon: Clock,
    title: 'Economize tempo',
    description: 'Reduza até 70% do tempo gasto em documentação clínica por atendimento.',
  },
  {
    icon: Target,
    title: 'Mais precisão',
    description: 'Estrutura padronizada com todos os campos da anamnese — nada esquecido.',
  },
  {
    icon: Shield,
    title: 'Seguro e privado',
    description: 'Dados processados com segurança. Sem armazenamento de áudio após transcrição.',
  },
  {
    icon: Download,
    title: 'Exportação fácil',
    description: 'Exporte em PDF ou DOCX compatível com qualquer sistema de prontuário.',
  },
]

export function BenefitsSection() {
  return (
    <section className="py-24 px-6 bg-card/30">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-foreground">Por que Anamnese IA?</h2>
          <p className="text-muted-foreground mt-2">Feito para a rotina do profissional de saúde</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {BENEFITS.map(({ icon: Icon, title, description }) => (
            <Card key={title}>
              <CardContent className="p-6 flex gap-4">
                <div className="h-10 w-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{title}</h3>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 5: Criar CTASection**

```tsx
// src/components/landing/CTASection.tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function CTASection() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-2xl mx-auto text-center space-y-6">
        <h2 className="text-3xl font-bold text-foreground">
          Pronto para transformar seus atendimentos?
        </h2>
        <p className="text-muted-foreground">
          Solicite acesso e comece a usar hoje mesmo. Sem cartão de crédito.
        </p>
        <Button asChild size="lg" className="px-10">
          <Link href="/solicitar-acesso">Solicitar acesso gratuito</Link>
        </Button>
      </div>
    </section>
  )
}
```

- [ ] **Step 6: Criar LandingFooter**

```tsx
// src/components/landing/LandingFooter.tsx
export function LandingFooter() {
  return (
    <footer className="border-t border-border py-8 px-6">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-sm font-semibold text-primary">Anamnese IA</span>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Anamnese IA. Todos os direitos reservados.
        </p>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <a href="/login" className="hover:text-foreground transition-colors">Entrar</a>
          <a href="/solicitar-acesso" className="hover:text-foreground transition-colors">Solicitar acesso</a>
        </div>
      </div>
    </footer>
  )
}
```

- [ ] **Step 7: Montar landing page em src/app/page.tsx**

Substitua todo o conteúdo de `src/app/page.tsx`:

```tsx
// src/app/page.tsx
import { LandingNavbar } from '@/components/landing/LandingNavbar'
import { HeroSection } from '@/components/landing/HeroSection'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { BenefitsSection } from '@/components/landing/BenefitsSection'
import { CTASection } from '@/components/landing/CTASection'
import { LandingFooter } from '@/components/landing/LandingFooter'

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-background">
      <LandingNavbar />
      <HeroSection />
      <HowItWorks />
      <BenefitsSection />
      <CTASection />
      <LandingFooter />
    </div>
  )
}
```

- [ ] **Step 8: Verificar landing no browser**

Acesse `http://localhost:3000`. Deve exibir navbar fixo + hero com glow + 3 seções + footer.

- [ ] **Step 9: Rodar testes**

```bash
npm test
```

Expected: todos passando.

- [ ] **Step 10: Commit**

```bash
git add src/app/page.tsx src/components/landing/
git commit -m "feat: add landing page with hero, how it works, benefits and CTA sections"
```

---

## Notas de Implementação

- **`src/lib/users.ts` é em memória** — reiniciar o servidor limpa os usuários criados via admin. Isso é esperado para o MVP. Quando migrar para Supabase, só trocar as funções `findUserByEmail`, `addUser`, etc.
- **Rota `/api/auth/setup` deve ser removida antes do deploy em produção** — usada só para gerar hash inicial da senha admin.
- **`ADMIN_PASSWORD_HASH` no `.env.local`** — após gerar via `/api/auth/setup`, reiniciar o servidor para que o novo hash seja lido no módulo `users.ts`.
- **`Button` usa `@base-ui/react/button`** internamente — o `asChild` pode não existir. Se houver erro com `asChild`, use `<Button onClick={() => router.push(href)}>` ou envolva com `<Link>` diretamente sem `asChild`.
