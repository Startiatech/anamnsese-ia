# Topbar da página de atendimento — largura máxima do conteúdo

**Data:** 2026-06-02

## Problema

Na página de atendimento ao paciente (`(session)/app/consultation/[id]`), o header
superior usava `flex justify-between px-6`, jogando a logo para o canto esquerdo
extremo e o `ThemeToggle` para o canto direito extremo. Em telas grandes (1920px+)
os dois elementos ficavam "perdidos" nas bordas.

## Solução

Envolver o conteúdo do header num container central com largura máxima — mesmo
padrão já usado na **topbar pública** (`src/components/layout/topbar.tsx`, variante
`public`: `flex justify-center` + `w-full max-w-5xl`).

- `src/app/(session)/app/consultation/[id]/consultation-page-flow.tsx`
  - Header: `flex items-center px-6` (borda inferior segue de ponta a ponta).
  - Conteúdo envolvido em `<div className="w-full max-w-screen-2xl mx-auto flex items-center justify-between">`.

### Por que `max-w-screen-2xl` (1536px)

- É o breakpoint topo do projeto (`2xl = 1536px`, documentado em
  `.claude/rules/responsiveness.md`) — não inventa valor novo.
- **Risco mínimo:** em telas ≤1536px o comportamento é idêntico ao anterior (a logo
  continua alinhada à sidebar `w-64`/`p-6` do corpo). Só em 1920px+ logo e tema
  recolhem juntos, resolvendo exatamente o incômodo relatado.
- `max-w-6xl` (1152px) recolheria já em ~1200px, estreitando a topbar em laptops
  comuns sem necessidade.

## TDD

1. RED → teste do container central (`max-w-screen-2xl` + `mx-auto` dentro do
   `role="banner"`) falhando.
2. GREEN → wrapper centralizado.
3. Resultado: `consultation-page-flow.test.tsx` — 13/13 verdes.
