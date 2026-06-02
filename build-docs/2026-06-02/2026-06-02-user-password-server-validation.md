# Validação de senha no servidor — lado user (PATCH /api/users/me)

**Data:** 2026-06-02

## Objetivo

Aplicar a mesma defesa em profundidade já feita no console master ao lado user:
validar a nova senha **no servidor** (não só no client) na troca de senha via
`PATCH /api/users/me`.

Antes, a rota hasheava `newPassword` direto, sem validar tamanho — a regra de
mínimo 8 vivia apenas no schema do client.

## Alterações

- `src/app/api/users/me/route.ts`
  - Importa `newPasswordSchema` de `@/lib/schemas` (mesma regra do console:
    `min(8)` + limite de 72 bytes do bcrypt).
  - Valida `newPassword` com `safeParse` **antes** de buscar o usuário, comparar a
    senha atual e hashear. Retorna `400` com a mensagem do zod se inválida.
  - Hash passa a usar `parsedPassword.data` (string tipada), removendo o
    `as string`.
  - O fluxo de senha temporária (reset via PIN, `passwordIsTemp`) continua não
    exigindo senha atual, mas agora também valida o tamanho da nova senha.

## TDD

1. RED → testes de rejeição (senha < 8 e > 72 bytes → 400) falhando.
2. GREEN → validação com `newPasswordSchema`.
3. Ajuste: o teste existente "includes password_is_temp: false" usava `newPassword: 'new'`
   (3 chars) e passou a usar `'newpass123'`.
4. Resultado: `route.test.ts` — 11/11 verdes.

## Notas

- Reutiliza o schema centralizado `newPasswordSchema` criado na entrega do console,
  garantindo regra única em todo o produto (user + master).
- `clinicSchema` e `accessibilityPrefsSchema` já eram validados; agora a senha
  fecha a lacuna restante de validação server-side nessa rota.
