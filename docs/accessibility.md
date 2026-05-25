# Plano de Acessibilidade — Anamnese IA

**Última auditoria:** 2026-05-23
**Norma de referência:** WCAG 2.1 nível AA
**Conformidade legal:** Lei Brasileira de Inclusão (Lei 13.146/2015), LGPD, CFM Res. 2.314/2022 (telemedicina)

---

## 1. Contexto e justificativa

O Anamnese IA é um sistema utilizado por **profissionais de saúde** (médicos, psicólogos, terapeutas) em contexto clínico, frequentemente em jornadas longas e com alta carga cognitiva. Como produto de saúde digital no Brasil, está sujeito a:

- **Lei Brasileira de Inclusão (LBI — Lei 13.146/2015)** — exige que produtos digitais sejam acessíveis a pessoas com deficiência
- **LGPD + Resolução CFM 2.314/2022** — sistemas que processam dados de saúde têm dever reforçado de garantir acesso adequado
- **WCAG 2.1 AA** — padrão de mercado internacional adotado por referência no Brasil (eMAG)

Este documento registra o **plano de adequação WCAG AA**, o estado de cada item e as ações executadas, servindo como **evidência de conformidade** para auditoria, certificação ou contratação por instituições de saúde.

---

## 2. Auditoria — estado inicial (2026-05-23)

Auditoria executada pelo agente `ui-reviewer` cobrindo as rotas autenticadas `(app)/`, `(admin)/console/` e fluxo `(session)/consultation/`.

### Itens críticos identificados

| # | Critério WCAG | Item | Status inicial |
|---|---|---|---|
| 1 | 2.4.1 Bypass Blocks | Skip link "Pular para conteúdo principal" | Ausente |
| 2 | 2.3.3 Animation from Interactions | `prefers-reduced-motion` respeitado | Ignorado em todo o projeto |
| 3 | 2.4.7 Focus Visible | Foco visível em botões destrutivos | Removido via `focus-visible:ring-0` |
| 4 | 1.4.3 Contrast (Minimum) | `--muted-foreground` no dark theme | ~4.0:1 (abaixo do mínimo 4.5:1) |
| 5 | 2.4.7 Focus Visible | Inputs nativos com `outline-none` sem fallback | Foco invisível em login, admin, settings |
| 6 | 1.3.1 / 4.1.2 Info and Relationships | `<Label htmlFor>` em inputs nativos | Parcialmente ausente |
| 7 | 3.3.4 Error Prevention | Confirmação dupla em "Finalizar atendimento" | Ação destrutiva clínica sem confirmação |

### Itens já em conformidade

- Trap de foco e tecla `Esc` em modais (Radix/shadcn nativo)
- Confirmação dupla em "Deletar usuário" e "Deletar conta"
- `prefers-color-scheme` — projeto é dark-only por decisão de design

---

## 3. Plano de adequação — 3 PRs incrementais

### PR 1 — Críticos globais
**Branch:** `feat/a11y-criticos-globais` · **Commit:** `b8274c5`

| Mudança | Arquivo | Critério WCAG |
|---|---|---|
| Skip link + `<main id="main-content" tabIndex={-1}>` no layout autenticado | `src/app/(app)/app-layout-client.tsx` | 2.4.1 |
| Skip link + `<main id="main-content" tabIndex={-1}>` no console admin | `src/app/(admin)/console/admin-layout-client.tsx` | 2.4.1 |
| Media query `@media (prefers-reduced-motion: reduce)` desabilitando animações globalmente | `src/app/globals.css` | 2.3.3 |
| Ajuste de `--muted-foreground` (dark) de `oklch(0.60)` para `oklch(0.72)` — contraste AA 4.5:1 | `src/app/globals.css` | 1.4.3 |
| Substituição de `focus-visible:ring-0` por `focus-visible:ring-2 ring-red-400 ring-offset-2` nos botões "Abandonar consulta" | `src/app/(session)/consultation/[id]/consultation-page-flow.tsx` | 2.4.7 |

### PR 2 — Foco e labels em formulários
**Branch:** `feat/a11y-criticos-globais` (continuação na mesma branch de testes)

| Mudança | Arquivos |
|---|---|
| Substituir `outline-none` sem fallback por `focus-visible:ring-2` consistente | `login-client.tsx`, `access-request-chat.tsx`, `tab-profile.tsx`, `add-user-modal.tsx`, `plans-client.tsx` |
| Garantir `<Label htmlFor>` associado a todos os inputs nativos | Mesmos arquivos acima |
| Adicionar `aria-label` em inputs sem label visível (busca, PIN) | Onde aplicável |

### PR 3 — Confirmação dupla em ações destrutivas clínicas
**Branch:** `feat/a11y-criticos-globais`

| Mudança | Arquivo |
|---|---|
| `AppDialog` de confirmação antes de finalizar atendimento (operação clínica irreversível com débito de crédito) | `src/app/(session)/consultation/[id]/consultation-page-flow.tsx` |

---

## 4. Atalhos de teclado

Modal global acionado por `Shift + ?` em qualquer rota autenticada. Documentado em `src/components/ui/keyboard-shortcuts-modal.tsx`.

| Atalho | Ação |
|---|---|
| `Shift + ?` | Abrir modal de atalhos |
| `Esc` | Fechar diálogo aberto |
| `Tab` / `Shift + Tab` | Navegar entre elementos |
| `Enter` | Ativar elemento focado |

O atalho não dispara quando o foco está em `<input>`, `<textarea>`, `<select>` ou elementos `contentEditable`, evitando interferência com formulários.

## 5. Itens de futuras fases (não bloqueantes)

### Fase 2 — Boas práticas de mercado
- Seletor de tamanho de fonte (padrão / grande / extra grande) na página de Configurações
- Tema de alto contraste como opção explícita (distinto do dark padrão)
- `<Toaster />` com `aria-live="polite"` confirmado explicitamente
- Skip links adicionais para sidebar e topbar
- Documentação de atalhos de teclado

### Fase 3 — Diferencial competitivo (acessibilidade cognitiva)
- Perfis de preferência: TEA (autismo), TDAH, dislexia, sensibilidade à luz
- Toggle de redução de elementos visuais competindo por atenção
- Fonte para dislexia (Atkinson Hyperlegible / OpenDyslexic) opcional

---

## 5. Processo contínuo

- **Toda nova feature** deve passar pelo agente `@ui-reviewer` com checklist de acessibilidade
- **Componentes novos** devem ser criados a partir de shadcn/ui (Radix) — primitivo já acessível
- **Auditoria completa** a cada release maior, atualizando a tabela da seção 2 deste documento
- **Issues** abertas com tag `a11y` para qualquer regressão identificada em produção
