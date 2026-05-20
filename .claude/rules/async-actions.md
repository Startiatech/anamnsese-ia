---
paths:
  - "src/components/**/*.tsx"
  - "src/app/**/*-client.tsx"
  - "src/app/**/page.tsx"
  - "src/server/actions/**"
---

## Ações assíncronas e formulários

### Toast (Sonner)
- Obrigatório `toast.promise` em toda ação assíncrona — nunca `toast.success` + `toast.error` em try/catch separado
- Loading: sempre `'Aguarde...'`

```typescript
// Correto
toast.promise(salvarDados(payload), {
  loading: 'Aguarde...',
  success: 'Salvo com sucesso.',
  error: 'Erro ao salvar — tente novamente.',
})
```

### Formulários React Hook Form
- `mode: 'onTouched'` obrigatório
- Schema com `zodResolver` — sempre de `src/lib/schemas.ts`
- Submit: `async onSubmit` + `await promise.catch(() => {})` → `isSubmitting` desabilita o botão

```typescript
const onSubmit = async (data: FormData) => {
  await toast.promise(minhaAction(data).catch(() => {}), {
    loading: 'Aguarde...',
    success: 'Salvo.',
    error: 'Erro ao salvar.',
  })
}

<Button type="submit" disabled={isSubmitting}>Salvar</Button>
```

### Botões de ação em lista/tabela
- `processingId` state por item — nunca `isLoading` global (bloqueia todos os itens)

```typescript
const [processingId, setProcessingId] = useState<string | null>(null)

// No render
<Button disabled={processingId === item.id} onClick={() => handleAction(item.id)} />
```

### `window.open` (links externos, WhatsApp)
- Chamar **antes** de qualquer `await` — popup blocker bloqueia após async

```typescript
// Correto
window.open(url, '_blank')
await registrarClique()

// Proibido
await registrarClique()
window.open(url, '_blank') // bloqueado
```

### Redirects pós-mutation
- Após salvar flags server-side (role, onboarding, blocked, plan): `window.location.href` — força recarga com novo estado do servidor
- `router.push` apenas para navegação pura sem mudança de estado server-side
