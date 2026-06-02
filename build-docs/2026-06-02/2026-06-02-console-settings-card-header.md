# Cabeçalho padrão nos cards de Configurações do console (master)

**Data:** 2026-06-02

## Objetivo

Igualar a apresentação dos blocos das abas **Perfil** e **Segurança** do console
master ao padrão já usado no lado **user**: cabeçalho de bloco com
**IconBadge + título uppercase + descrição**.

Antes, os cards do console exibiam apenas os campos, sem o cabeçalho de contexto.

## Alterações

- `src/app/(admin)/console/settings/tabs/tab-profile.tsx`
  - Card "Pessoais" ganhou header com `IconBadge` (ícone `UserCircle`), título
    **"Pessoais"** e descrição "Informações de identificação básica da conta master.".
  - Markup espelha o lado user: header `flex gap-4` + container de campos com `mt-5`.
- `src/app/(admin)/console/settings/tabs/tab-security.tsx`
  - Card de senha ganhou header com `IconBadge` (ícone `KeyRound`), título **"Senha"**
    e descrição recomendando senha forte (mesma copy do lado user).

## TDD

1. RED → testes dos cabeçalhos (título + descrição) falhando.
2. GREEN → adição dos headers com `IconBadge`.
3. Resultado: `tab-profile` e `tab-security` do console — 6/6 verdes.
   - `src/app/(admin)/console/settings/tabs/tab-profile.test.tsx` (teste novo do header)
   - `src/app/(admin)/console/settings/tabs/tab-security.test.tsx` (arquivo novo)

## Review

- `@ui-reviewer`: tokens, tipografia (`text-foreground`/`text-muted-foreground`),
  `IconBadge` e ícones corretos. Apontou divergência de markup no profile
  (`mb-5` no header vs. `mt-5` no conteúdo) — **corrigido** para espelhar o user.
  Security já estava alinhado.

## Unificação da regra de senha

- A descrição da senha cita "pelo menos 8 caracteres". O schema do console validava
  mínimo de **6**, divergindo do lado user (mínimo 8). **Unificado para mínimo 8**
  (`z.string().min(8, 'Mínimo 8 caracteres')`) em
  `src/app/(admin)/console/settings/tabs/tab-security.tsx`, alinhando validação e copy.
- Teste TDD adicionado: senha com 7 caracteres exibe "Mínimo 8 caracteres" e não
  dispara o submit. `tab-security` do console — 3/3 verdes.

### Defesa em profundidade (servidor)

- Criados schemas centralizados em `src/lib/schemas.ts`:
  - `newPasswordSchema` — regra única `min(8)` + limite de **72 bytes** (refine com
    `TextEncoder`). O limite de 72 bytes existe porque o `bcryptjs` trunca a entrada
    silenciosamente além disso; `max(200)` seria enganoso (apontado pelo
    `@security-reviewer`).
  - `masterPasswordChangeSchema` — currentPassword + newPassword + confirmPassword
    com refine de coincidência.
- `updateMasterProfile` (`src/server/actions/settings.ts`) agora valida a troca de
  senha com `masterPasswordChangeSchema` **antes** de comparar/hashear — rejeita
  senha < 8 e divergência de confirmação no servidor, não só no client.
- O client do console (`tab-security.tsx`) passou a importar o schema centralizado,
  eliminando a duplicação do schema inline.
- Mensagem de divergência unificada para "As senhas não coincidem" (mesma copy do
  client); teste da action ajustado de acordo.
- Cobertura: `settings.test.ts` (10 testes, incluindo o novo "rejeita senha < 8") e
  `tab-security.test.tsx` (3) — 13/13 verdes.
