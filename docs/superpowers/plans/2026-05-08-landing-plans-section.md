# Landing Page — Seção de Planos (PlansSection)

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar seção de planos à landing page com três cards (Experimental, Profissional, Gestão & Clínicas), ajustar navbar para incluir link "Planos" e CTA direto "Solicitar acesso", alterar hero para direcionar ao scroll da seção e atualizar label do CTA final.

**Architecture:** Componente Client (`PlansSection`) puro de UI — sem dados do servidor por ora. Features do Experimental/Profissional são estáticas (serão dinamizadas futuramente via back). "Quero ser avisado" dispara `toast.success` (Sonner). Scroll entre seções via anchor `id="planos"`. Light/dark mode suportado com tokens CSS e classes `dark:`.

**Decisões de design (brainstorming desta conversa):**
- Navbar: "Planos" (anchor scroll) + "Solicitar acesso" (link direto `/login?mode=solicitar`) + "Entrar" (botão primário)
- Hero: CTA principal vira "Ver planos" (scroll `#planos`) · secundário mantém "Já tenho acesso"
- Card Experimental: badge `Beta`, features listadas, CTA "Solicitar acesso gratuito" → `/login?mode=solicitar`
- Card Profissional: badge `Popular` (gradiente violet-cyan), mesmas features do Experimental, CTA "Quero ser avisado" (toast)
- Card Gestão & Clínicas: sem features listadas, texto teaser, CTA "Quero ser avisado" (toast)
- CTASection: label atualizado de "acesso por convite" → "fase beta · acesso por solicitação"
- Ordem na LP: `BenefitsSection` → `PlansSection` → `CTASection`

---

## File Map

| Ação | Arquivo |
|---|---|
| Criar | `src/components/landing/plans-section.tsx` |
| Modificar | `src/components/landing/landing-navbar.tsx` |
| Modificar | `src/components/landing/hero-section.tsx` |
| Modificar | `src/components/landing/cta-section.tsx` |
| Modificar | `src/app/(marketing)/page.tsx` |

---

## Task 1: PlansSection component

**Files:**
- Create: `src/components/landing/plans-section.tsx`

- [ ] **Step 1: Criar componente `PlansSection`**

  - `'use client'`
  - `id="planos"` na `<section>`
  - Overline + headline com gradiente violet-cyan-emerald
  - Três cards em grid `md:grid-cols-3`
  - `EXPERIMENTAL_FEATURES` array estático compartilhado entre Experimental e Profissional
  - Card Experimental: badge `Beta` (violet/10), lista de features com `Check` (emerald), CTA `Link href="/login?mode=solicitar"`
  - Card Profissional: badge `Popular` absoluto no topo com gradiente, ring violet, mesmo array de features, `NotifyButton`
  - Card Gestão & Clínicas: sem lista, texto teaser centralizado, `NotifyButton`
  - `NotifyButton`: `toast.success` com nome do plano — `Bell` icon
  - Animações `framer-motion` `whileInView` com `viewport={{ once: true }}`
  - Light/dark: usar tokens `bg-card`, `border-border`, `text-foreground`, `text-muted-foreground` + `dark:` onde necessário

---

## Task 2: Ajustes na LandingNavbar

**Files:**
- Modify: `src/components/landing/landing-navbar.tsx`

- [ ] **Step 2: Adicionar link "Planos" e manter "Solicitar acesso" como ação direta**

  - Antes do separador (`div.w-px`): adicionar `<a href="#planos">` com mesmo estilo do link existente
  - Manter "Solicitar acesso" apontando para `/login?mode=solicitar` (não mais scroll)
  - Ordem final: `ThemeToggle` · `Planos` · `Solicitar acesso` · separador · `Entrar`

---

## Task 3: Ajustes no HeroSection

**Files:**
- Modify: `src/components/landing/hero-section.tsx`

- [ ] **Step 3: Trocar CTA principal por "Ver planos"**

  - Trocar `<Link href="/login?mode=solicitar">` do botão primário por `<a href="#planos">`
  - Texto: "Ver planos" com ícone `ArrowRight`
  - Manter botão secundário "Já tenho acesso" → `/login` inalterado

---

## Task 4: Ajuste no CTASection

**Files:**
- Modify: `src/components/landing/cta-section.tsx`

- [ ] **Step 4: Atualizar label overline**

  - Trocar `"acesso por convite"` por `"fase beta · acesso por solicitação"`

---

## Task 5: Registrar PlansSection no page.tsx

**Files:**
- Modify: `src/app/(marketing)/page.tsx`

- [ ] **Step 5: Importar e posicionar `PlansSection`**

  - Import: `import { PlansSection } from '@/components/landing/plans-section'`
  - Posição: entre `<BenefitsSection />` e `<CTASection />`
