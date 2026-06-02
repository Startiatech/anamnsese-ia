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

## Notas

- A descrição da senha cita "pelo menos 8 caracteres" (copy espelhada do user);
  o schema do console valida mínimo de 6 — é texto de recomendação, não validação,
  mantido por paridade visual. Avaliar unificar a regra em entrega futura.
