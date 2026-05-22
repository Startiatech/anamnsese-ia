# E2E Tests — Playwright

Suite end-to-end do Anamnese IA. Cobre LP, login, app do usuario profissional e console master nos 4 viewports.

## Pre-requisitos

- `.env.test` preenchido com chaves do projeto `anamnese-ia-com-claude-code--teste`
- Usuario master fixo existente: `projectanamneseai2026@gmail.com`
- Dependencias instaladas: `pnpm install` + `pnpm exec playwright install chromium`

## Comandos

| Comando | Uso |
| --- | --- |
| `pnpm test:e2e` | Roda suite completa |
| `pnpm test:e2e --project=mobile` | So mobile (375x667) |
| `pnpm test:e2e:ui` | Modo interativo (debug visual) |
| `pnpm test:e2e:headed` | Roda vendo o navegador |
| `pnpm test:e2e:report` | Abre relatorio HTML pos-run |

## Estrutura

```
e2e/
├── global-setup.ts       # validacao anti-producao
├── global-teardown.ts    # cleanup final
├── fixtures/             # auth, seed, mocks, supabase client
└── specs/
    ├── public/           # landing, login, request access
    ├── app/              # dashboard, patients, consultation, settings
    └── console/          # users, access-requests, feedbacks
```

## Padroes obrigatorios

- **Locators:** `getByRole` > `getByLabel` > `getByTestId` > `getByText`. Sem CSS frageis.
- **Esperas:** `await expect(...).toBeVisible()`. Nunca `waitForTimeout`.
- **Dados:** todo registro criado tem prefixo `e2e-`. Cleanup automatico no final.
- **IA:** specs de consulta DEVEM usar `mockAiEndpoints(page)` antes de iniciar fluxo.
- **Viewport:** se UI muda entre tamanhos, asserções condicionais por `test.info().project.name`.

## Troubleshooting

| Sintoma | Causa provavel |
| --- | --- |
| `E2E abortado: NEXT_PUBLIC_SUPABASE_URL...` | `.env.test` apontando para projeto errado |
| Timeout 30s no login | dev server nao subiu (verifique porta 3000) |
| Locator nao encontrado | UI mudou — atualizar spec ou adicionar `data-testid` |
| Banco com lixo `e2e-*` | Suite cancelada antes do teardown — roda `pnpm test:e2e` que limpa, ou SQL manual |

## Limpeza manual (banco de teste)

Se algum teste deixou lixo:

```sql
DELETE FROM users WHERE email LIKE 'e2e-%@test.com';
-- demais tabelas cascateiam por FK ou via cleanupE2eData()
```

## Agente revisor

PRs com mudancas em `e2e/` devem passar pelo agente `@e2e-playwright-reviewer`.
