# Build 2026-05-26 — Ajustes no toast de loading + feedback ao iniciar atendimento

Documento vivo. Atualizar a cada alteração desta sessão.

## Contexto

Dois ajustes relacionados a feedback visual de operações assíncronas:

1. **Spinner do toast de loading do Sonner** estava com a animação de rotação inconsistente — em algumas máquinas/temas o spinner aparecia parado. Após testar override com `Loader2` + `animate-spin` e CSS forçando `animation: rotate`, optou-se por **remover o ícone** e dar destaque ao texto via `animation: pulse`.
2. **Botão "Iniciar atendimento"** na lista de pacientes ([src/components/consultation/consultation-page-client.tsx](src/components/consultation/consultation-page-client.tsx)) navegava direto via `router.push` sem feedback visual durante a transição. Adicionado `toast.promise` para indicar a transição.

## Alterações

### 1. Toaster — remover ícone de loading e adicionar pulse no texto
- **Arquivo:** [src/app/layout.tsx](src/app/layout.tsx)
- **Mudança:** `icons.loading` no `<Toaster>` agora é `<></>` (fragmento vazio). Removido o `import { Loader2 } from 'lucide-react'`.
- **Motivo:** rotação inconsistente do `Loader2` mesmo com `animate-spin` aplicado e keyframe customizado no CSS. Solução pragmática: tirar o ícone, manter só o texto destacado.

### 2. globals.css — esconder container do ícone e pulsar o texto
- **Arquivo:** [src/app/globals.css](src/app/globals.css)
- **Mudança:**
  - `[data-sonner-toast][data-type="loading"] [data-icon] { display: none !important; }` — esconde o container do ícone para não deixar espaço/borda vazia.
  - `[data-sonner-toast][data-type="loading"] [data-title]` recebe `animation: sonner-loading-pulse 1.4s ease-in-out infinite`.
  - Keyframe `sonner-loading-pulse` — opacidade oscila entre `1` e `0.55`.
- **Resultado:** toast azul "Aguarde..." com pulsação suave, sem spinner.

### 3. Consulta — toast.promise no clique "Iniciar atendimento"
- **Arquivo:** [src/components/consultation/consultation-page-client.tsx](src/components/consultation/consultation-page-client.tsx)
- **Mudança:** o handler do botão envolve `router.push` em uma `Promise` que resolve após 800ms e dispara `toast.promise`:

```typescript
const navigate = new Promise<void>((resolve) => {
  router.push(ROUTES.atendimentoId(patient.id))
  setTimeout(resolve, 800)
})
toast.promise(navigate, {
  loading: 'Aguarde...',
  success: 'Atendimento iniciado.',
  error: 'Erro ao iniciar atendimento.',
})
```

- **Motivo:** dar feedback visual durante a transição entre a lista de pacientes e a tela de atendimento.
- **Observação:** o `processingId` continua mantendo o botão desabilitado para prevenir duplo clique.

## TDD

Alterações puramente visuais/UX. Não há contrato de comportamento novo que justifique testes unitários adicionais — toast de loading já é coberto por testes que asseguram a mensagem "Aguarde..." nos fluxos de mutation.

## Observações pós-entrega

Durante os testes desta sessão, foi identificado um **bug crítico de débito/estorno de créditos** que não está relacionado a estas mudanças visuais mas foi descoberto ao validar o fluxo de "Iniciar atendimento". Análise e plano de correção em [docs/superpowers/plans/2026-05-26-credits-wallet-symmetric-refund.md](docs/superpowers/plans/2026-05-26-credits-wallet-symmetric-refund.md).
