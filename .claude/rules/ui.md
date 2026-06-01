---
paths:
  - "src/components/**"
  - "src/app/**/page.tsx"
  - "src/app/**/layout.tsx"
  - "src/app/**/*-client.tsx"
---

## UI e arquitetura de componentes

### Design system
- **Light + dark** — ambos os temas são suportados. Toda cor nova precisa funcionar nos dois.
  - Cor de texto/ícone: usar par `text-*-600/700 dark:text-*-400` — nunca `-400` sozinho (lava no light).
  - Gradiente da marca: sempre `var(--gradient-brand)` (azul→cyan) — proibido hex inline (`#8B5CF6` etc.).
  - **Glow/neon:** usar tokens `var(--glow-*)` (transparente no light, neon no dark) ou `hidden dark:block`.
    Nunca `shadow-[0_0_..._rgba()]` fixo — o neon vaza no light.
- Proibido `rgba()`/hex hardcoded em componentes reutilizáveis — usar tokens CSS (`globals.css`)
- Inputs: `border-b` apenas, sem border completo ou card pesado
- Base obrigatória: shadcn/ui — não reinventar inputs, dropdowns, dialogs, cards

### Inputs em formulários — regra obrigatória
- **Proibido** usar `<Input>` (shadcn) em formulários de settings, onboarding ou qualquer campo estilo "underline"
- Motivo: shadcn `<Input>` tem `focus-visible:ring-2` e `px-3` no base que conflitam com overrides via className — tailwind-merge não resolve completamente
- **Obrigatório** usar `FieldInput` + `FieldLabel` de `src/components/ui/field-input.tsx` nesses contextos
- `FieldInput` é nativo (`<input>`), aceita `ref`, e expõe `className` para extensão via `cn()`
- shadcn `<Input>` continua válido apenas para casos onde o estilo padrão shadcn é desejado (ex: modais de busca, filtros)

### Componentes de layout
- Sheet lateral: sempre via `AppSheet` (`src/components/ui/app-sheet.tsx`) — nunca `Sheet` direto
- Topbar/Sidebar: únicos em `src/components/layout/`, recebem dados via props
- Admin e profissional compartilham os mesmos componentes de layout

### Topbar scroll effect (todas as variantes: public, user, admin)
- Threshold: 60px — hook `useScrolled` interno ao `topbar.tsx`
- Ao ultrapassar: `backdrop-blur(24px)` + bg `rgba(18,14,40,0.92)` + border `rgba(139,92,246,0.18)`

### Server vs Client Components
- Padrão: Server Component — `'use client'` só para `useState`, `useEffect`, event handlers, browser APIs
- Proibido `useEffect + fetch` para buscar dados — buscar sempre em Server Components
- Layouts: sempre Server Components que passam dados via props aos clientes

### Context
- Usuário, créditos, logout: `AppContext` (`src/context/AppContext.tsx`)
- Fluxo de atendimento: `ConsultationContext` (`src/context/ConsultationContext.tsx`)
- Não criar contextos novos sem necessidade clara — preferir props para dados locais
