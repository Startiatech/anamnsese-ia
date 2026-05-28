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

## 5. Fase 3 — Ajustes adicionais (filosofia híbrida)

Filosofia explícita: **rotular por efeito, não por condição.** Nenhum toggle é nomeado "Modo TEA / TDAH / Dislexia". Cada ajuste descreve o que faz; o usuário combina os que ajudam. Padrão alinhado com Apple/iOS, GOV.UK e Microsoft — evita o accessibility theater dos overlays comerciais.

### Toggles disponíveis

| Toggle | `data-attr` no `<html>` | Efeito CSS |
|---|---|---|
| Espaçamento de leitura | `data-spacing-increased="true"` | `letter-spacing 0.04em`, `word-spacing 0.08em`, `line-height 1.7-1.8` |
| Destacar elemento em foco | `data-focus-highlight="true"` | `outline 3px solid amarelo` + box-shadow expandido em `*:focus-visible` |
| Reduzir movimento (extra) | `data-extra-reduced-motion="true"` | Todas animações/transições reduzidas a `0.01ms` |

Todos persistidos em colunas booleanas em `public.users` e sincronizados via PATCH `/api/users/me`. Os 3 toggles são GA — visíveis para todos os usuários (o feature flag `beta_a11y_v2` foi removido).

A aba Acessibilidade está disponível em **ambos os lados**: `(app)` (médico/cliente) e console master (`(admin)/console/settings`). O componente `TabAccessibility` é reutilizado; no console renderiza com `showRequestCard={false}` (o card "Falta algum ajuste?" envia pedidos ao master, então não faz sentido o próprio master enviá-los a si mesmo).

### Sino de notificações (`NotificationBell`)

Sistema reutilizável de comunicação in-app pareado com a Fase 3:
- Tabela `notifications` com tipos `info | feature | warning`
- Sino na topbar com badge de não lidas (até `99+`)
- Click-outside e `Esc` fecham
- Atualização otimista local + sincronização via Server Action

Importante: **banners críticos (PinTempBanner, DeletionBanner) NÃO migram para o sino.** A regra é:
- **Banner** = comunicação bloqueante/acionável crítica (sem dispensar até resolver)
- **Sino** = comunicação informacional (dispensável a qualquer momento)

### Canal aberto: "Falta algum ajuste?"

Card de pedido livre no rodapé da aba Acessibilidade. Usuário escreve em texto livre (10-500 chars) o que ajudaria sua experiência. Persistido em `accessibility_requests` com status `pending | read | archived`.

**Visualização admin** em `/console/feedbacks` (aba "Acessibilidade"), com:
- Lista ordenada por data desc
- Nome + email do solicitante
- Ações: Marcar como lido / Arquivar
- Badge com contagem de pendentes no título da aba
- **Badge no sidebar** do console (item "Feedbacks") seguindo padrão de "Solicitações" — polling 30s + toast `ℹ N novo(s) pedido(s) de acessibilidade` quando incrementa

Princípio adotado: **escutar antes de adivinhar.** Em vez de implementar toggles especulativos ("modo TEA", "fonte dislexia") sem dados, deixamos o usuário definir o roadmap pela voz dele. Quando um pedido aparece com frequência, vira candidato a feature.

### Itens deferidos para futuras fases

- Fonte para dislexia (Atkinson Hyperlegible) — só implementar quando vier pelo canal aberto
- Reduzir saturação de cores — risco de efeito colateral em gradientes/logos
- Modo "Reduzir distrações" — requer redesign de várias telas
- Presets ("Sugerir combinação") por questionário neutro
- Migrar PinTempBanner/DeletionBanner para infraestrutura compartilhada com notifications

---

## 6. Cobertura de testes (Fases 1, 2 e 3)

| Camada | Arquivo | Testes |
|---|---|---|
| Repository a11y | `src/server/repositories/users-accessibility.test.ts` | 9 |
| Repository notifications | `src/server/repositories/notifications.test.ts` | 10 |
| Server Action a11y | `src/server/actions/accessibility.test.ts` | 7 |
| Server Action notifications | `src/server/actions/notifications.test.ts` | 8 |
| API route a11y (cases pref*) | `src/app/api/users/me/route.test.ts` | 5 |
| Context/hook | `src/context/accessibility-context.test.tsx` | 15 |
| UI: aba Acessibilidade | `src/app/(app)/settings/tabs/tab-accessibility.test.tsx` | 14 |
| UI: NotificationBell | `src/components/layout/notification-bell.test.tsx` | 11 |
| UI: atalhos | `src/components/ui/keyboard-shortcuts-modal.test.tsx` | 5 |
| UI: skip link (Fase 1) | `src/components/ui/skip-link.test.tsx` | 5 |
| UI: confirmação finalizar (Fase 1) | `src/app/(session)/consultation/[id]/complete-confirm-dialog.test.tsx` | 4 |
| Repository: accessibility_requests | `src/server/repositories/accessibility-requests.test.ts` | 9 |
| Server Actions: accessibility_requests | `src/server/actions/accessibility-requests.test.ts` | 12 |
| UI: RequestFeedbackCard | `src/app/(app)/settings/tabs/request-feedback-card.test.tsx` | 9 |

Total: **123 testes** dedicados a acessibilidade + notificações + pedidos abertos.

## 7. Processo contínuo

- **Toda nova feature** deve passar pelo agente `@ui-reviewer` com checklist de acessibilidade
- **Componentes novos** devem ser criados a partir de shadcn/ui (Radix) — primitivo já acessível
- **Auditoria completa** a cada release maior, atualizando a tabela da seção 2 deste documento
- **Issues** abertas com tag `a11y` para qualquer regressão identificada em produção
