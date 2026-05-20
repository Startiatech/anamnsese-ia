# Anamnese IA — Core System Design

**Date:** 2026-03-26
**Status:** Approved
**Scope:** Core system only (Auth/Admin-Master is a separate sub-project)

---

## 1. Overview

Ferramenta de apoio clínico para processamento de áudio e geração de anamnese estruturada. O profissional grava a consulta, envia o arquivo de áudio, e o sistema transcreve e estrutura o conteúdo no formato SOAP, pronto para exportação em PDF e DOCX.

**Não é um ERP/prontuário.** É uma ferramenta de apoio — armazena apenas a última anamnese por paciente.

**Uso:** profissional solo (fase de experimento/testes inicial).

**Condição de uso:** somente quando o paciente autorizar a gravação. Consultas sem autorização seguem no ERP do profissional, fora deste sistema.

---

## 2. Stack Tecnológico

| Camada | Tecnologia |
|--------|-----------|
| Frontend + Backend | Next.js (App Router) + TypeScript |
| Estilização | Tailwind CSS |
| Banco de dados (fase testes) | localStorage (estrutura espelhando o Supabase futuro) |
| Banco de dados (produção) | Supabase PostgreSQL |
| Transcrição de áudio | Groq Whisper (`whisper-large-v3-turbo`) |
| Geração de anamnese | Groq LLM (`llama-3.3-70b-versatile`) |
| Exportação PDF | `@react-pdf/renderer` |
| Exportação DOCX | `docx` (npm) |

**Fase de testes:** IA e banco ficam mockados. O fluxo completo funciona com dados simulados, permitindo validar UX antes de integrar APIs externas.

---

## 3. Arquitetura

```
[Browser]
    │
    └── Next.js App
          ├── /app (frontend — React + Tailwind)
          │     ├── /                    → redirect para /pacientes
          │     ├── /pacientes           → listagem e busca de pacientes
          │     ├── /pacientes/novo      → cadastro de paciente
          │     ├── /atendimento/[id]    → fluxo completo de atendimento (steps)
          │     └── /resultado/[id]      → anamnese final + exportação
          │
          └── /app/api (API Routes — backend)
                ├── POST /api/transcribe   → recebe áudio, chama Groq Whisper
                ├── POST /api/anamnesis    → recebe transcrição + seções, chama Groq LLM
                └── POST /api/export      → gera PDF ou DOCX

[Camada de dados — abstraída]
    ├── Fase testes: localStorage
    └── Fase produção: Supabase PostgreSQL
```

**Nota sobre áudio:** o arquivo de áudio é processado em memória na API Route e descartado imediatamente. Nenhum arquivo de áudio é salvo — responsabilidade do profissional sobre o arquivo original.

---

## 4. Fluxo de Atendimento (Steps)

### Step 1 — Seleção / Cadastro do Paciente
- Campo de busca por CPF ou nome
- Se encontrado: exibe dados e permite selecionar
- Se não encontrado: opção de cadastrar novo paciente
- **Campos obrigatórios:** nome completo, CPF
- **Campos opcionais:** data de nascimento, telefone
- Validação de CPF (formato)

### Step 2 — Confirmação de Responsabilidade
- Tela informativa explicando que o sistema será utilizado para processar a gravação
- Checkbox obrigatório: *"Confirmo que orientei o paciente sobre a gravação da consulta e que ele autorizou o uso deste sistema"*
- Sem marcar o checkbox, não avança

### Step 3 — Upload de Áudio
- Área de upload (drag & drop + clique)
- Formatos aceitos: `.mp3`, `.wav`, `.m4a`, `.ogg`
- Exibe nome e tamanho do arquivo selecionado
- Permite trocar o arquivo quantas vezes quiser antes de processar
- Botão "Iniciar Processamento" só ativa com arquivo selecionado
- Indicador de progresso durante o envio/transcrição

### Step 4 — Revisão do Texto Bruto e Customização das Seções
- Exibe a transcrição bruta gerada pelo Whisper
- Sistema identifica automaticamente quais seções SOAP estão presentes no texto
- Profissional pode:
  - **Manter** seções identificadas (padrão: todas marcadas)
  - **Remover** seções que não deseja na anamnese final
  - **Adicionar** seções extras não-SOAP (ex: "Histórico Familiar", "Medicamentos em Uso", "Alergias")
- Botão "Gerar Anamnese" confirma a seleção e dispara o LLM

### Step 5 — Anamnese Estruturada
- Exibe a anamnese gerada com as seções escolhidas
- Cada seção é editável (textarea) para ajustes finos
- Botões de exportação: **"Exportar PDF"** e **"Exportar DOCX"**

---

## 5. Exportação de Documentos

### Estrutura do documento (PDF e DOCX)

**Cabeçalho:**
```
[Nome do Médico]                    Data: DD/MM/AAAA
CRM: XXXXX/UF | [Especialidade]
─────────────────────────────────────────────────────
Paciente: [Nome]                    CPF: XXX.XXX.XXX-XX
Data de Nascimento: DD/MM/AAAA      Telefone: (XX) XXXXX-XXXX
```

**Corpo:**
- Seções da anamnese na ordem definida pelo profissional
- Cada seção com título em destaque e conteúdo

**Rodapé:**
```
Documento gerado em DD/MM/AAAA às HH:MM — Anamnese IA
```

**Dados do médico (fase testes):** mockados via variável de configuração local. Na produção virão do perfil configurado no onboarding.

---

## 6. Modelo de Dados

### `patients`
```
id          uuid (PK)
name        text — obrigatório
cpf         text — obrigatório, único
birth_date  date — opcional
phone       text — opcional
created_at  timestamp
```

### `consultations`
```
id                    uuid (PK)
patient_id            uuid (FK → patients)
raw_transcript        text
structured_anamnesis  jsonb  — { sections: [{ title, content }] }
created_at            timestamp
updated_at            timestamp
```

**Regra:** um paciente tem no máximo uma `consultation`. Ao gerar nova anamnese, a anterior é sobrescrita (update). O objetivo é apenas lembrar o profissional da última consulta, sem histórico.

### localStorage (fase testes)
- `anamnese_patients` → array de objetos `patients`
- `anamnese_consultations` → array de objetos `consultations`
- Camada de acesso abstraída em `lib/db.ts` — na migração para Supabase, só este arquivo muda

---

## 7. Processamento de IA (fase produção)

### Transcrição — Groq Whisper
- Endpoint: `POST /api/transcribe`
- Recebe: arquivo de áudio (multipart/form-data)
- Processa em memória — sem salvar em disco
- Modelo: `whisper-large-v3-turbo`
- Retorna: `{ transcript: string }`

### Geração de Anamnese — Groq LLM
- Endpoint: `POST /api/anamnesis`
- Recebe: `{ transcript: string, sections: string[] }`
- Modelo: `llama-3.3-70b-versatile`
- Prompt em português instrui o modelo a extrair somente as seções solicitadas do texto bruto
- Retorna: `{ sections: [{ title: string, content: string }] }`

### Fase de testes (mock)
- `/api/transcribe` retorna transcrição fictícia após delay simulado
- `/api/anamnesis` retorna anamnese SOAP fictícia após delay simulado
- Flag de ambiente `NEXT_PUBLIC_MOCK_AI=true` ativa o modo mock

---

## 8. Estrutura de Diretórios

```
/
├── app/
│   ├── page.tsx                        → redirect
│   ├── pacientes/
│   │   ├── page.tsx                    → listagem
│   │   └── novo/page.tsx               → cadastro
│   ├── atendimento/
│   │   └── [id]/page.tsx               → steps 1-5
│   ├── resultado/
│   │   └── [id]/page.tsx               → anamnese final
│   └── api/
│       ├── transcribe/route.ts
│       ├── anamnesis/route.ts
│       └── export/route.ts
├── components/
│   ├── steps/                          → componentes de cada step
│   ├── anamnesis/                      → visualização e edição da anamnese
│   └── export/                        → templates PDF e DOCX
├── lib/
│   ├── db.ts                           → abstração localStorage / Supabase
│   ├── mock/                           → dados e respostas mock
│   └── pdf.ts / docx.ts               → geração de documentos
└── types/
    └── index.ts                        → tipos Patient, Consultation, Section
```

---

## 9. Padrões de Engenharia

### Arquitetura de Componentes
- **Design System próprio** — componentes base em `components/ui/` (Button, Input, Card, Badge, Spinner, etc.) usados em toda a aplicação para consistência visual
- **Componentização por responsabilidade** — cada componente faz uma coisa; componentes de página orquestram, componentes menores são puros e reutilizáveis
- **DRY** — lógica repetida extraída para hooks customizados em `hooks/` (ex: `usePatient`, `useConsultation`, `useExport`)
- **Sem prop drilling** — estado global via React Context + Providers (ex: `ConsultationContext` para o fluxo de atendimento)

### Padrão de Projeto (Next.js + Supabase)
- **App Router** com Server Components onde possível — dados estáticos ou de servidor renderizados no servidor
- **Client Components** apenas onde necessário (interatividade, localStorage, eventos)
- **Server Actions** para mutações de dados (cadastro de paciente, salvar anamnese) — evita API Routes desnecessárias
- **Repository pattern** em `lib/db.ts` — isola acesso a dados, facilita troca localStorage → Supabase sem tocar nos componentes

### Responsividade
- Mobile-first com Tailwind CSS
- Layout funcional em telas a partir de 375px (smartphone)
- Fluxo de atendimento otimizado para uso em tablet/desktop (ambiente clínico típico)

### Acessibilidade
- Semântica HTML correta (headings, labels, roles)
- Navegação por teclado em todos os fluxos
- Contraste mínimo WCAG AA
- Feedback visual e textual em estados de loading, erro e sucesso

### Performance
- Lazy loading de componentes pesados (PDF renderer, DOCX generator)
- Sem dependências desnecessárias — instalar só o que for usado
- Loading states em todas as operações assíncronas (transcrição, geração, exportação)

### Qualidade de Código
- TypeScript estrito — sem `any`
- Tipos centralizados em `types/index.ts`
- Nomes descritivos em português para domínio (paciente, consulta, anamnese) e inglês para estrutura técnica (handler, provider, hook)

---

## 10. Fora do Escopo (Core)

Os itens abaixo pertencem a sub-projetos separados:

- Autenticação (login/logout)
- Admin-master (gestão de profissionais e planos)
- Onboarding do profissional
- Gestão de planos/billing
- Landing page de marketing
- Histórico de consultas
- Multi-profissional / multi-clínica
