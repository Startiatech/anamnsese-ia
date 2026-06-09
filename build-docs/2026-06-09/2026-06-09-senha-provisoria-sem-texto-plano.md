# Elimina senha provisória em texto plano (regenerar sob demanda)

**Data:** 2026-06-09
**Tipo:** `fix(security)`
**Origem:** auditoria de segurança dirigida (item 4, ALTO) — decisão de produto: opção A

## Problema

A senha provisória era persistida em texto plano na coluna `users.temp_password_plain` para permitir "Ver credenciais" no console. Um dump da tabela `users` expunha senhas válidas de todo usuário que ainda não trocou a senha — inaceitável para SaaS médico. Viola o princípio de não armazenar credenciais de forma recuperável (OWASP ASVS).

## Solução (opção A — regenerar sob demanda)

"Ver credenciais" vira **"Reenviar credenciais"**: em vez de ler uma senha armazenada, o sistema gera uma nova senha temporária (CSPRNG), persiste **apenas o hash** e devolve o texto plano **uma única vez** na resposta. Nenhuma credencial recuperável permanece no banco.

Guard preservado: só regenera enquanto `password_is_temp = true`. Se o usuário já definiu a própria senha, retorna 410 — regenerar sequestraria a conta dele.

A rota passou de `GET` para `POST` (regenerar é mutação) e foi refatorada para usar repositórios (testável).

## Arquivos alterados

- `src/app/api/admin/requests/[id]/view-credentials/route.ts` — `GET`→`POST`, regenera via `hashPassword` + `generateTempPassword` + `updateUser`
- `src/app/api/admin/requests/[id]/view-credentials/route.test.ts` — novo (8 casos)
- `src/server/repositories/requests.ts` — novo `findRequestById`
- `src/app/api/admin/create-user/route.ts` — remove escrita de `temp_password_plain`
- `src/app/api/users/me/route.ts` — remove limpeza de `temp_password_plain` (coluna removida)
- `src/app/(admin)/console/requests/requests-client.tsx` — fetch `POST`, rótulo "Reenviar credenciais", toasts
- `src/app/(admin)/console/requests/request-card.tsx` — rótulo "Reenviar credenciais"
- `src/app/(admin)/console/requests/request-card.test.tsx` — labels atualizados
- `supabase/migrations/20260609_drop_users_temp_password_plain.sql` — `DROP COLUMN temp_password_plain`

## Migration — aplicar nos DOIS bancos

```sql
ALTER TABLE public.users DROP COLUMN IF EXISTS temp_password_plain;
```

Rodar em **prod** (`anamnese-ia-com-claude-code--prod`) **e** dev (`anamnese-ia-com-claude-code--dev`). Aplicar o código antes do drop (o código já não referencia a coluna; ordem segura).

## Evolução futura (registrada, fora deste fix)

Fluxo de **link tokenizado** para o próprio usuário definir a senha no primeiro acesso — ninguém em momento algum conhece ou armazena a senha do usuário.
