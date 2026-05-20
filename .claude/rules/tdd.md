---
paths:
  - "src/**/*.test.ts"
  - "src/**/*.test.tsx"
  - "src/**/*.integration.test.ts"
  - "src/tests/**"
  - "src/server/repositories/**"
---

## TDD obrigatório

### Lógica pura (utils, schemas, componentes sem I/O)
```
1. RED    → escreve o teste unitário, vê falhar  →  pnpm test
2. GREEN  → implementa o mínimo para passar
3. REFACTOR
```

### Repositório / camada Supabase (qualquer função que chama `supabase.*`)
```
1. RED unitário   → testa lógica e mapeamento com Supabase mockado  →  pnpm test
2. GREEN          → implementa o repositório
3. RED integração → testa contra o banco real                        →  pnpm run test:integration
4. GREEN          → corrige divergências mock ↔ realidade
5. REFACTOR
```

Unitário valida lógica interna. Integração valida que o SQL/RPC funciona no banco real. Nunca substituir uma pela outra.

### Mocks Supabase
```typescript
const mockSupabase = vi.hoisted(() => ({
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
}))

vi.mock('@/server/supabase', () => ({ supabase: mockSupabase }))
```

### Convenções técnicas
- Testes de auth: `// @vitest-environment node` como primeira linha (jose exige Uint8Array nativo)
- Integração: sufixo `.integration.test.ts`, localização `src/tests/integration/`
- Seed/teardown: `seedUser`, `seedAccessRequest` de `@/tests/integration/seed` — sempre limpar em `afterEach`
- Repositórios com `insert`: obrigatório verificar `error` e lançar exceção — nunca engolir silenciosamente
- Helpers de teste: tipar com estrutura exata retornada, nunca `any`
