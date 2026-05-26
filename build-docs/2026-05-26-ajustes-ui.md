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
