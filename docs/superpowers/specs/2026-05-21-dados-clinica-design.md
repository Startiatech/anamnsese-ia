# Dados da Clínica — Design Doc

**Data:** 2026-05-21
**Status:** Spec aprovado, aguardando plano de implementação

## Resumo

Permitir que o profissional cadastre dados da sua clínica (logo, identificação, contato, endereço, responsável técnico, horário) e usar esses dados no cabeçalho/rodapé do PDF e DOCX gerados ao final de cada anamnese. Os dados são coletados no onboarding (nova aba obrigatória entre Perfil e Segurança) e editáveis em `/settings`. Usuários existentes sem dados são forçados a preencher antes de iniciar um novo atendimento.

## Motivação

Hoje o PDF/DOCX da anamnese sai sem cabeçalho personalizado. Para um documento médico profissional, é esperado conter logo + identificação da clínica + responsável técnico (exigência regulatória CFM/ANVISA). Coletar esses dados uma vez no onboarding e reutilizá-los em todos os documentos gerados.

## Escopo

### Dentro
- Migration adicionando colunas `clinic_*` em `users`
- Bucket `clinic-logos` no Supabase Storage (já criado)
- Endpoints `POST` e `DELETE` para upload/remoção de logo
- Extensão do `PATCH /api/users/me` para aceitar campos `clinic_*`
- Schema Zod `clinicSchema` com validação de CNPJ (dígito verificador), CEP, telefone BR, e-mail RFC
- Nova aba `Clínica` em `/settings` (obrigatória no onboarding entre Perfil e Segurança)
- Gate em "Iniciar atendimento": redireciona para `/settings?force=clinica&next=...` se `clinicComplete = false`
- Modificação dos templates `src/lib/pdf.ts` e `src/lib/docx.ts` para renderizar cabeçalho + rodapé com dados da clínica
- Atualização de `src/components/export/export-buttons.tsx` para passar os dados
- Testes unitários e de integração
- Atualização de `docs/architecture.md`

### Fora
- Renderização customizada de tema/cor do PDF
- Múltiplas unidades por clínica
- Clínica compartilhada entre profissionais
- QR code, assinatura digital
- Re-renderização de anamneses antigas (sairão com fallback sem logo)

## Modelo de dados

Migration: `supabase/migrations/YYYYMMDDHHMMSS_add_clinic_fields_to_users.sql`

Todas as colunas `nullable` (retrocompatibilidade com usuários existentes):

| Coluna | Tipo | Obrigatório no app | Observação |
|---|---|---|---|
| `clinic_name` | `text` | sim | |
| `clinic_cnpj` | `text` | sim | 14 dígitos, sem máscara |
| `clinic_address` | `text` | sim | endereço completo numa linha |
| `clinic_cep` | `text` | sim | 8 dígitos, sem máscara |
| `clinic_phone` | `text` | sim | formato BR `(00) 00000-0000` |
| `clinic_email` | `text` | sim | RFC |
| `clinic_logo_url` | `text` | sim | URL pública do bucket |
| `clinic_logo_path` | `text` | sim | path interno (`{userId}/{timestamp}.{ext}`) — usado para delete |
| `clinic_website` | `text` | opcional | aceita com ou sem `https://` |
| `clinic_rt_is_self` | `boolean` default `true` | — | toggle "Sou o Responsável Técnico" |
| `clinic_rt_name` | `text` | obrigatório se `rt_is_self = false` | |
| `clinic_rt_registry` | `text` | obrigatório se `rt_is_self = false` | ex: "CRM/SP 123456" |
| `clinic_business_hours` | `text` | opcional | free text, ex: "Seg-Sex 8h-18h" |

**Helper derivado server-side** (não persistido): `clinicComplete: boolean` — `true` quando todos os obrigatórios preenchidos (considerando lógica condicional do RT).

## Storage

Bucket: `clinic-logos` (Supabase Storage).

- **Público:** sim (URLs lidas direto pelo navegador no PDF e no preview da UI)
- **Tamanho máximo:** 2 MB
- **MIME types permitidos:** `image/png`, `image/jpeg`, `image/webp`, `image/svg+xml`
- **Path:** `{userId}/{timestamp}.{ext}`
- **Escrita:** apenas via service_role (server-side); usuário nunca tem credencial direta

## Endpoints

### `POST /api/users/me/clinic/logo`
- Recebe `FormData` com arquivo
- Valida MIME + tamanho server-side (redundância com bucket policies)
- Se já existir `clinic_logo_path` em `users`: deleta arquivo anterior do bucket
- Faz upload do novo arquivo
- Atualiza `clinic_logo_url` e `clinic_logo_path` em `users`
- Retorna `{ url, path }`
- 401 sem auth, 413 se tamanho excedido, 415 se MIME inválido

### `DELETE /api/users/me/clinic/logo`
- Deleta arquivo do bucket
- Zera `clinic_logo_url` e `clinic_logo_path` em `users`
- 204 em sucesso

### `PATCH /api/users/me` (estendido)
- Continua aceitando os campos do perfil
- Aceita também `clinic_*` (exceto `logo_url`/`logo_path`, que têm endpoint próprio)
- Schema Zod valida o payload inteiro
- Atualização parcial: campos não enviados não são alterados

## Repository

`src/server/repositories/users.ts`:

- `StoredUser` type ganha as 13 colunas novas
- `updateClinicData(userId, data: ClinicData)` — atualiza colunas `clinic_*` (exceto logo)
- `updateClinicLogo(userId, { url, path })` — atualiza apenas `clinic_logo_url` + `clinic_logo_path`
- `clearClinicLogo(userId)` — zera as duas colunas de logo
- Helper `isClinicComplete(user: StoredUser): boolean` exportado para uso no gate

## Schemas

`src/lib/schemas.ts`:

- `clinicSchema` — schema Zod com validação:
  - `clinic_name`: string min 2
  - `clinic_cnpj`: string com dígito verificador válido (helper interno)
  - `clinic_cep`: regex `^\d{8}$`
  - `clinic_phone`: regex telefone BR
  - `clinic_email`: `.email()`
  - `clinic_website`: `.url()` opcional com normalização (`https://` se faltar)
  - `clinic_rt_is_self`: boolean
  - `clinic_rt_name` / `clinic_rt_registry`: required quando `rt_is_self = false` (via `superRefine`)
  - `clinic_business_hours`: string opcional
- `ClinicFormData` type derivado

## UI

### `src/app/(app)/settings/tabs/tab-clinic.tsx`
Segue padrão do `tab-profile.tsx`: `forwardRef<ClinicHandle>` com `validate` e `getValues`, React Hook Form + `zodResolver(clinicSchema)`, `mode: 'onTouched'`, `FieldInput` + `FieldLabel`.

Estrutura visual em 3 cards:

1. **Identificação** (ícone `Building2`)
   - `ClinicLogoUpload` (componente novo, drag-and-drop + preview + remover)
   - Nome da clínica · CNPJ
   - Telefone · E-mail
   - Site *(opcional)*

2. **Endereço** (ícone `MapPin`)
   - Endereço (linha cheia)
   - CEP

3. **Informações adicionais** (ícone `Info`)
   - Toggle ☑ "Sou o Responsável Técnico desta clínica" (default marcado)
   - Nome do RT · Registro do RT *(visíveis apenas se desmarcado)*
   - Horário de atendimento *(opcional, free text)*

Todos os opcionais marcam o label com `(opcional)`.

### `src/app/(app)/settings/tabs/clinic-logo-upload.tsx`
- Drag-and-drop ou click para selecionar arquivo
- Preview da imagem atual
- Validação client-side de MIME + tamanho antes do POST
- Botão "Remover" chama `DELETE /api/users/me/clinic/logo`
- Toast.promise no upload e no delete

### `settings-client.tsx`
- `TabId` ganha `'clinica'`
- Ordem das abas no onboarding: `perfil` → `clinica` → `seguranca`
- `clinicValidated` state local; segurança bloqueada até `profileValidated && clinicValidated`
- Botão único: "Próxima etapa" em perfil e clinica; "Salvar alterações" em segurança
- `handleProceed` salva tudo em sequência: perfil → clínica → senha → redireciona

### Gate em "Iniciar atendimento"
- Server Component da rota de entrada chama `getServerUser()` e `isClinicComplete(user)`
- Se incompleto: `redirect('/settings?force=clinica&next=<rota original>')`
- `SettingsClient` lê `searchParams.force === 'clinica'`:
  - Trava Perfil e Segurança (disabled, com tooltip "Complete os dados da clínica para continuar")
  - Abre aba Clínica
  - Mostra aviso suave no topo: "Complete os dados da sua clínica para iniciar um novo atendimento"
- Após salvar: `window.location.href = searchParams.next` (recarga server-side força estado atualizado)
- Aba Clínica permanece editável livremente em `/settings` (sem `force`)

## PDF e DOCX

### `src/lib/pdf.ts`
- Assinatura ganha parâmetro `clinic: ClinicData` (extraído do `StoredUser`)
- **Cabeçalho:**
  - Logo (à esquerda) — fallback ausente: usa placeholder textual com nome da clínica em destaque
  - Nome da clínica (título)
  - Linha 2: CNPJ · Telefone · E-mail
  - Site abaixo se preenchido
- **Rodapé:**
  - Endereço completo + CEP
  - "Responsável Técnico: {nome} — {registro}" (usa dados do perfil se `rt_is_self = true`)
  - Horário de atendimento se preenchido

### `src/lib/docx.ts`
- Mesma estrutura, equivalente no formato `docx`
- Logo carregado como buffer (fetch do `clinic_logo_url`)

### `src/components/export/export-buttons.tsx`
- Recebe `clinic` via prop ou via `AppContext`
- Passa para as funções de export

### Fallback para anamneses antigas
- Se `clinic_*` ausente: PDF/DOCX sai sem cabeçalho personalizado (template legado)
- Não bloqueia re-exportação

## Rotas

`src/lib/routes.ts`:

```ts
API.users.clinicLogo // '/api/users/me/clinic/logo'
```

## Testes

### Repositório (`users.test.ts`)
- `updateClinicData` atualiza só `clinic_*` (exceto logo) sem afetar perfil
- `updateClinicLogo` atualiza só `clinic_logo_url` e `clinic_logo_path`
- `clearClinicLogo` zera as duas colunas
- `isClinicComplete` retorna `true` apenas quando todos os obrigatórios preenchidos
- `isClinicComplete` respeita lógica condicional do RT (`rt_is_self = true` ignora `rt_name`/`registry`)

### Schemas (`schemas.test.ts`)
- `clinicSchema` rejeita CNPJ com dígito verificador inválido
- `clinicSchema` aceita CNPJ válido sem máscara
- `clinicSchema` rejeita CEP fora do formato
- `clinicSchema` exige `clinic_rt_name`/`registry` quando `rt_is_self = false`
- `clinicSchema` permite RT vazio quando `rt_is_self = true`
- `clinicSchema` normaliza site sem `https://`

### Endpoint logo (integração)
- Rejeita arquivo > 2MB (413)
- Rejeita MIME fora da allowlist (415)
- Upload deleta logo anterior do bucket e salva novas colunas
- DELETE remove arquivo e zera colunas
- Rejeita sem auth (401)

### Endpoint PATCH `/api/users/me`
- Aceita payload misto (perfil + `clinic_*`) sem quebrar
- Validações Zod aplicadas no server

### UI
- `tab-clinic.test.tsx`: toggle "Sou o RT" esconde/mostra campos; validação local roda antes de `getValues`
- `clinic-logo-upload.test.tsx`: rejeita arquivo grande, mostra preview, dispara delete
- `settings-client.test.tsx`: `force=clinica` desabilita Perfil/Segurança; após salvar, redireciona para `next`

### PDF e DOCX
- `pdf.test.ts`: cabeçalho contém nome + CNPJ + contatos; rodapé contém endereço + RT + horário
- `pdf.test.ts`: fallback sem logo renderiza placeholder textual
- `docx.test.ts`: equivalentes

## Documentação de arquitetura

`docs/architecture.md`:

- Atualizar diagrama de onboarding: `Perfil → Clínica → Segurança`
- Adicionar diagrama do gate em "Iniciar atendimento" → `/settings?force=clinica`
- Adicionar diagrama do fluxo de upload de logo (cliente → endpoint → bucket → users)

## Rollout

1. Migration aplicada (colunas nullable, zero impacto em usuários existentes)
2. Deploy do código
3. Usuários novos: onboarding já inclui aba Clínica
4. Usuários existentes: continuam usando normalmente; ao tentar "Iniciar atendimento", são levados ao gate
5. Anamneses antigas re-exportadas saem com fallback (sem cabeçalho)

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| CNPJ inválido escapando para o PDF | Validação de dígito verificador no Zod + server-side |
| Logo grande prejudicando PDF | Limite 2MB no bucket + validação client/server |
| Cache CDN de logo após troca | Path com timestamp resolve (novo arquivo = nova URL) |
| Usuário recusa preencher e fica preso | Aba Clínica continua acessível em `/settings`; gate só dispara em "Iniciar atendimento" — usuário pode navegar livre no resto |
| Logo SVG malicioso | MIME allowlist + bucket público sem execução; SVG renderizado como imagem, não embed |
