# Build 2026-05-26 — Ajustes de UI

Documento vivo. Atualizar a cada alteração desta sessão.

## Alterações

### 1. Logo — wordmark `anamnese_IA_`
- **Arquivos:** `src/components/ui/logo.tsx`, `src/components/landing/logo.tsx`
- **Mudança:** removido o ícone spark (símbolo radial) que aparecia como prefixo do texto. Wordmark passa de `anamnese IA` para `anamnese_IA_`.
  - Texto base `anamnese` mantém cor padrão.
  - `_IA_` recebe gradiente (mesma cor da parte "IA" antiga) — sublinhados antes e depois fazem parte do segmento colorido.
- **Aplica-se a:** LP, sidebars/topbars do user e do master, e modais que usam `<Logo />`.

### 2. Sidebar do user — header limpo e trigger único
- **Arquivos:** `src/components/layout/sidebar.tsx`, `src/components/layout/sidebar.test.tsx` (novo)
- **Mudança:**
  - Removido o `LogoMark` (ponto colorido) do header da sidebar.
  - Wordmark inline atualizado para `anamnese_IA_` (com sublinhados como parte do segmento colorido).
  - Quando recolhido: header mostra apenas o `SidebarTrigger`, centralizado — clicar reabre a sidebar.
  - Quando expandido: wordmark à esquerda, `SidebarTrigger` à direita.
- **TDD:** teste em `sidebar.test.tsx` cobre os dois estados (expanded/collapsed).

### 3. Consolidação — `<Logo />` como fonte única
- **Arquivos:** `src/components/ui/logo.tsx` (fonte única), `src/components/ui/logo.test.tsx` (novo), `src/components/layout/sidebar.tsx` (passa a consumir `<Logo />`), `src/components/landing/logo.tsx` (removido).
- **Mudança:**
  - `src/components/landing/logo.tsx` excluído — não tinha consumidores e duplicava o wordmark com cores hardcoded.
  - Sidebar deixa de ter wordmark inline e usa `<Logo size="sm" id="sidebar" />`.
  - Alterações futuras de logo passam exclusivamente por `src/components/ui/logo.tsx`.
- **TDD:** novo `logo.test.tsx` garante que `<Logo />` sempre renderiza `anamnese` + `_IA_`.

### 4. Landing navbar — respiro simétrico
- **Arquivo:** `src/components/landing/landing-navbar.tsx`
- **Problema:** entre ~640px e ~1024px, o botão "Entrar" parecia colado na borda direita enquanto a logo tinha respiro à esquerda. Causa: assimetria perceptiva — logo é texto transparente, botão tem fundo sólido; mesmo `px-6` do wrapper externo, o olho percebia menos respiro do lado do botão.
- **Correção:** padding interno no `<nav>` (`px-2 sm:px-4`) garantindo respiro simétrico independente do wrapper externo.
- **TDD:** ajuste puramente visual de classe CSS, sem contrato comportamental — validado por @ui-reviewer.

### 5. Hero — "gerada por IA" em azul sólido
- **Arquivo:** `src/components/landing/hero-section.tsx`
- **Mudança:** substituído gradient triplo (violeta→sky→verde) por azul sólido `#38BDF8` (sky-400) no segmento "gerada por IA" da headline. Objetivo: tom mais sóbrio, reduzindo a "cara de projeto gerado por IA".
- **TDD:** alteração visual, E2E continua passando (só valida o texto).

### 6. LP + login — padronização do tom azul (token `--primary`)
- **Objetivo:** reduzir a "cara de projeto gerado por IA" — eliminar gradientes triplos e variações violet/cyan dispersas, padronizando os destaques no azul `--primary` do design system.
- **Hero (já em #5):** "gerada por IA" migrado de cor sólida sky-400 para `text-primary`.
- **Demo widget:** `text-violet-400` → `text-primary` em "Demo gerada por IA".
- **How it works:** eyebrow "Como funciona" e segmento "em 3 passos" → `text-primary`.
- **Benefits:** eyebrow "Benefícios" e segmento "Anamnese IA" → `text-primary`.
- **Plans:** eyebrow "planos" + segmento "cresça quando quiser" → `text-primary`. Traço esquerdo removido para alinhar o texto flush com o título abaixo.
- **CTA:** eyebrow "fase beta · acesso por solicitação" + segmento "atendimentos?" → `text-primary`. Traço esquerdo removido (mesmo motivo de alinhamento).
- **Eyebrows — saturação:** removido o `/80` de opacidade nos eyebrows "planos" e "fase beta..." para igualar o tom dos demais destaques em `text-primary` cheio.

### 7. Settings — remoção do `loading.tsx`
- **Arquivo removido:** `src/app/(app)/app/settings/loading.tsx`
- **Motivo:** o padrão das demais páginas autenticadas (`dashboard`, `history`, `plans`, `consultation`) é não ter `loading.tsx` — assim o Next.js mantém a página anterior visível durante a navegação até o server component terminar de carregar, sem flash de spinner/skeleton. Apenas `result/[id]` (relatório pesado) mantém loading próprio. O `loading.tsx` do settings (primeiro com `Loader2` em tela cheia, depois com skeleton) quebrava esse padrão.
- **Login:**
  - Headline "documentada por IA." (versão desktop e mobile) → `text-primary`.
  - "Esqueceu a senha?" → hover usa `hover:text-primary`.
  - "Solicitar" (após "Não tem acesso?") → `text-primary` com `hover:opacity-80`.
  - Ícones (FEATURES): estilo "pastel saturado" trocado por glow rgba + border 0.25 — alinhado ao padrão sutil dos `BenefitCard` da LP.
- **TDD:** alterações puramente visuais. E2E da landing (`landing.spec.ts`) só valida texto e continua válido.
