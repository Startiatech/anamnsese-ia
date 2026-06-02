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
- Observação: a validação de tamanho vive no schema do client (tanto user quanto
  master); a Server Action `updateMasterProfile` não revalida o tamanho — mesma
  postura já existente no lado user. Endurecer no servidor fica como melhoria futura.
