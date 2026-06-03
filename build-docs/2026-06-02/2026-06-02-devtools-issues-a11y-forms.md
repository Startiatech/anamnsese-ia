# Varredura de issues do DevTools — atributos de formulário (a11y)

**Data:** 2026-06-02
**Status:** em andamento (auditoria página por página, com o usuário)

## Contexto

Auditoria das **Issues** do Chrome DevTools, tela por tela, focada em avisos de
campos de formulário:

- `A form field element should have an id or name attribute`
- `An element doesn't have an autocomplete attribute`
- `No label associated with a form field`

São **recomendações** do navegador (não erros), mas indicam código semanticamente
incompleto. Decisão de `autocomplete` por contexto (documentada em
`.claude/rules/ui.md`):

- Busca/filtro → `off`
- Admin gerenciando outro usuário → `off`
- Form do próprio dono (login/settings/onboarding) → token real (`name`/`email`/`tel`/`current-password`/`new-password`)

## Telas corrigidas

### `/console/users`
- Input de busca: `type=search` + `name=user-search` + `autocomplete=off`.
- Filtro de status (shadcn `<Select>`): `name=status-filter` (o Radix renderiza um
  campo nativo escondido que herda o `name`).
- Modal "Novo usuário" (4 campos): `autocomplete=off` (admin cria outro usuário —
  não autofillar dados do admin).
- Teste TDD: `users-client.test.tsx` (campo de busca tem `name`),
  `add-user-modal.test.tsx` (campos com `autocomplete=off`).

### `/console/plans` (criar/editar plano)
- 4 campos fixos (Nome/Descrição/Preço/Franquia): `id`+`name`+`<label htmlFor>`+`autocomplete=off`.
- Inputs de funcionalidade (dinâmicos): `name` único + `aria-label`.
- `<label>` de grupo "Funcionalidades" → `<span>` (rotula lista, não campo).
- Respiro horizontal: `px-2` no `fieldClass` (alinha ao padrão `FieldInput`).
- Sem harness de teste para este componente (correção de atributo).

### `/console/settings` (master — Perfil + Segurança)
- `FieldLabel`/`FieldInput` não se associavam (label sem `htmlFor`, input sem `id`).
- Perfil: Nome/Email/Telefone com `id`+`htmlFor`+autocomplete (`name`/`email`/`tel`);
  email `disabled` ganhou `id`+`name`.
- Segurança: 3 campos de senha com `id` (via `reg.name`)+`htmlFor`+autocomplete
  (`current-password`/`new-password`). É o próprio master → tokens reais.
- Teste TDD: `tab-profile.test.tsx` (label associado + autocomplete).

### `/login` (login, esqueci a senha, solicitar acesso)

Form do **próprio usuário** → tokens reais de autocomplete.

- Login: email `autocomplete=username`, senha `autocomplete=current-password`.
- Esqueci a senha: email `autocomplete=username`, PIN `autocomplete=off` (PIN de
  recuperação, não é campo padrão de autofill).
- Solicitar acesso (`access-request-chat.tsx`): input do chat e input de edição
  ganharam `name` + `autocomplete=off` (+ `aria-label` no de edição).
- Nota: o painel **Issues do DevTools acumula** avisos dos modos visitados na sessão
  (login/forgot/request) mesmo que só um esteja montado por vez — por isso apareceram
  campos de modos não-visíveis.

### `/app/dashboard` → modal "Novo paciente"

- `BirthDateSelect` (data de nascimento) usa 3 shadcn `<Select>` (dia/mês/ano), cada
  um com campo nativo Radix escondido sem `name`. Adiciona `name`
  (`birth-date-day`/`-month`/`-year`). Componente compartilhado → corrige também o
  "Editar paciente". Os demais campos do form (nome/CPF/telefone/prontuário) já
  tinham `id`+`name`.

## Regra documentada

`.claude/rules/ui.md` → nova seção **"Atributos obrigatórios em campos de formulário"**:
todo `<input>`/`FieldInput`/`<Select>` deve ter `name`/`id` + `autocomplete`
explícitos; revisar telas novas pela aba Issues do DevTools antes de declarar pronto.

## Pendências conhecidas (recorrência do par `FieldLabel`/`FieldInput`)

O mesmo aviso de "label não associado" / autocomplete vai aparecer nas telas que
reutilizam `FieldInput`/`FieldLabel` e ainda não foram visitadas:

- **User settings** (`/app/settings`): tab-profile, tab-clinic, tab-security
- **Onboarding** (mesmos tabs)

Serão corrigidas conforme a auditoria página por página avança. Melhoria futura
possível: fazer `FieldInput`/`FieldLabel` auto-associarem via `useId` (refactor à
parte, reduz o trabalho por-site).

## Commits

`e391d05` · `4f510a2` · `82fffb1` · `e723faa` · `8987f18` · `8e27871`
