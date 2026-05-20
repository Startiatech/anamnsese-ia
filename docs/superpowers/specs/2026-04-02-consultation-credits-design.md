# Consultation Flow — Credit Guard & Real-Time Display

**Date:** 2026-04-02  
**Status:** Approved

---

## Overview

Implementar verificação e débito de créditos antes de iniciar um atendimento, estorno automático em caso de abandono sem uso, e exibição em tempo real dos créditos na Topbar.

---

## 1. Credit Guard — Antes de Iniciar Atendimento

### Abordagem
Option B: guard no Server Component `consultation/page.tsx`.

### Fluxo
1. `consultation/page.tsx` (Server Component) busca `credits_remaining` do usuário via `getServerUser()` + `CreditRepository.getCredits(user.id)`
2. Passa `hasCredits: boolean` como prop para o botão client `NewConsultationButton`
3. Ao clicar:
   - `hasCredits === false` → abre `NoCreditsModal` (sem navegar)
   - `hasCredits === true` → `POST /api/auth/me/debit` → sucesso → `refreshCredits()` → toast → navega para `/consultation/novo`

### Componente `NewConsultationButton`
- Client component extraído do `PageHeader` action
- Estado: `processing` (boolean) para desabilitar durante o fetch
- Padrão `toast.promise` com `loading: 'Aguarde...'`, `success: '1 crédito utilizado (restam N)'`, `error: 'Erro ao processar crédito'`

### `NoCreditsModal`
- `createPortal` no `document.body`, `z-[200]`
- Sem fechar ao clicar fora — apenas X ou botão
- Título: *"Seus créditos acabaram"*
- Descrição: *"Você não possui créditos disponíveis para iniciar um novo atendimento. Faça upgrade do seu plano para continuar."*
- Botão primário gradient violet→cyan: *"Ver planos"* → `ROUTES.planos`
- Botão ghost: *"Fechar"*
- Logo do projeto no ícone (mesmo SVG spark dos outros modais)

---

## 2. Débito de Crédito

### Timing
Débito ocorre **no início** — ao clicar em "Novo atendimento", antes de entrar no fluxo.

### Justificativa
- Evita race condition (usuário com 1 crédito abrindo 2 abas)
- Consulta já consome recursos do servidor (transcrição, IA) mesmo sem conclusão
- Padrão SaaS: paga pela sessão, não pela conclusão

### API
`POST /api/auth/me/debit` — já existente. Retorna `{ ok: true }`. Saldo atualizado obtido via `refreshCredits()` (GET /api/auth/me) em seguida.

---

## 3. Estorno Automático

### Quando estornar
Se o usuário sair de `/consultation/novo` sem ter criado o paciente com sucesso (steps 1–2 do fluxo), o crédito é devolvido.

### Implementação
- Ao debitar com sucesso → `sessionStorage.setItem('consultation_debit_pending', '1')`
- Em `/consultation/novo` (mount):
  - Verifica flag no `sessionStorage`
  - Ao criar paciente com sucesso → `sessionStorage.removeItem('consultation_debit_pending')` (atendimento confirmado, não estorna)
- Ao sair de `/consultation/novo` com flag ainda ativa (botão "← Voltar", link externo):
  - `POST /api/auth/me/credit` (novo endpoint +1 crédito)
  - `refreshCredits()`
  - Toast: *"Crédito estornado"*

### Nova API route
`POST /api/auth/me/credit` — incrementa `credits_remaining + 1` via `CreditRepository`.

### Edge case
Fechamento abrupto do browser → crédito perdido. Aceitável — caso raro, pode ser tratado manualmente via suporte.

---

## 4. Exibição em Tempo Real — Topbar

### Posição
Chip ao lado do avatar na `Topbar`, sempre visível (desktop e mobile).

### Visual
```
✦ 3    ← credits > 3: text-muted-foreground
✦ 2    ← credits <= 3: text-amber-400
✦ 0    ← credits === 0: text-destructive
```

### Dados
- Consome `credits` do `AppContext` (já disponível via `GET /api/auth/me`)
- `AppContext` ganha `refreshCredits()` — refaz fetch de `/api/auth/me` e atualiza estado
- `NewConsultationButton` chama `refreshCredits()` após debit/credit

### Atualização em tempo real
- Após débito: `refreshCredits()` → chip atualiza imediatamente
- Após estorno: `refreshCredits()` → chip atualiza imediatamente
- Sem polling — atualização é event-driven (após ações do usuário)

---

## 5. Mudanças por Arquivo

| Arquivo | Tipo de mudança |
|---|---|
| `src/app/(app)/consultation/page.tsx` | Busca credits server-side, passa `hasCredits` prop |
| `src/components/dashboard/new-consultation-button.tsx` | Novo client component — debit + modal |
| `src/components/dashboard/no-credits-modal.tsx` | Novo modal portal |
| `src/components/layout/Topbar.tsx` | Adiciona chip de créditos |
| `src/context/app-context.tsx` | Expõe `refreshCredits()` |
| `src/app/(app)/consultation/novo/page.tsx` | Lógica de estorno via sessionStorage |
| `src/app/api/auth/me/credit/route.ts` | Nova route POST +1 crédito |

---

## 6. Fora do Escopo

- Botão de saída de emergência no fluxo de atendimento (será avaliado ao testar a UI)
- Renovação automática de créditos mensais (futuro)
- Histórico de consumo de créditos (futuro)
