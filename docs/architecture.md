# Arquitetura — Anamnese IA

> Documento gerado automaticamente. Atualizar sempre que uma nova funcionalidade for implementada.

---

## Fluxo de Autenticação

```mermaid
flowchart TD
    A([Requisição HTTP]) --> B{proxy.ts}

    B -->|Rota pública\n/ · /login · /request-access| C[Passa direto]
    B -->|Asset ou /api/auth/*| C
    B -->|Sem token JWT| D[Redirect → /login]
    B -->|Token válido| E{Verificar role}

    E -->|role: user| F[App /dashboard]
    E -->|role: admin ou master| G[Admin /console]
    E -->|user tentando /console| D

    F --> H[layout.tsx app\ngetServerUser]
    G --> I[layout.tsx admin\ngetServerUser]

    H --> J[AppContext\nusuário · créditos · logout]
    I --> K[ConsoleNotificationContext]
```

---

## Route Groups e Páginas

```mermaid
flowchart LR
    APP[src/app/]

    APP --> MK["(marketing)/\npúblico"]
    APP --> AU["(auth)/\nautenticação"]
    APP --> AP["(app)/\napp autenticado"]
    APP --> AD["(admin)/console/\npainel admin"]
    APP --> SS["(session)/\nvisualização sem login"]

    MK --> MK1[request-access/]

    AU --> AU1[login/]

    AP --> AP1[dashboard/]
    AP --> AP2[consultation/\nnovo/]
    AP --> AP3[result/id/]
    AP --> AP4[history/]
    AP --> AP5[plans/]
    AP --> AP6[settings/tabs/]

    AD --> AD1[users/]
    AD --> AD2[plans/]
    AD --> AD3[requests/]
    AD --> AD4[feedbacks/]
    AD --> AD5[settings/tabs/]

    SS --> SS1[consultation/id/]
```

---

## Fluxo de Consulta (feature principal)

```mermaid
sequenceDiagram
    actor Médico
    participant UI as consultation/novo
    participant CTX as ConsultationContext
    participant API as /api/anamnesis
    participant REFINE as /api/anamnesis/refine
    participant SA as Server Action\ncredits.ts
    participant DB as Supabase

    Médico->>UI: Inicia atendimento
    UI->>CTX: setConsultation(data)
    Médico->>UI: Grava áudio / envia transcrição
    UI->>API: POST /api/anamnesis
    API->>DB: Busca configurações do usuário
    API-->>UI: Retorna anamnese gerada (IA)
    UI->>CTX: setResult(anamnese)

    Médico->>UI: Solicita refinamento
    UI->>REFINE: POST /api/anamnesis/refine
    REFINE-->>UI: Retorna anamnese refinada

    UI->>SA: debitCredit(userId, amount)
    SA->>DB: Debita créditos
    SA-->>UI: Confirma débito

    Médico->>UI: Salva consulta
    UI->>DB: POST /api/consultations
    DB-->>UI: id da consulta
    UI->>Médico: Redirect → /result/id
```

---

## Camadas do Servidor

```mermaid
flowchart TB
    subgraph Client["Client (browser)"]
        CC[AppContext]
        CCTX[ConsultationContext]
        COMP[Componentes React]
    end

    subgraph ServerBoundary["Server Boundary"]
        SC[Server Components\nlayouts · pages]
        SA[Server Actions\nsrc/server/actions/]
        AR[API Routes\nsrc/app/api/]
    end

    subgraph ServerCore["src/server/ — exclusivo server-side"]
        SVC[services/\nauth.ts · session.ts]
        REPO[repositories/\nusers · credits · plans\nrequests · feedbacks\nusage · system-config]
        DB[(Supabase\nservice_role)]
    end

    COMP -->|fetch / Server Action| SA
    COMP -->|fetch| AR
    SC --> SVC
    SA --> REPO
    AR --> REPO
    SVC --> DB
    REPO --> DB
```

---

## API Routes

```mermaid
flowchart LR
    API[src/app/api/]

    API --> AUTH[auth/\nlogin · logout\nforgot-password\nme · me/credit · me/debit]

    API --> CONS[consultations/\nGET · POST\nid/]

    API --> ANM[anamnesis/\nPOST — gera anamnese\nrefine/ — refina]

    API --> PAT[patients/\nGET · POST\nid/ · id/latest-consultation]

    API --> ADM[admin/\ncreate-user\nusers/ · users/id\nusers/id/reset-pin\nusers/id/groq-cost\nplans/id]

    API --> CRON[cron/\npurge-accounts]
```

---

## Créditos — Ciclo de Vida

```mermaid
flowchart TD
    A[Usuário sem créditos] -->|Acessa /plans| B[Página de planos]
    B -->|Escolhe plano| C[Checkout Stripe]
    C -->|Webhook confirmado| D[Server Action: addCredit]
    D --> E[(Supabase: tabela credits)]

    F[Fluxo de consulta] -->|Anamnese gerada| G[Server Action: debitCredit]
    G --> E
    E --> H[AppContext: atualiza saldo]
    H --> I[SidebarCredits: exibe saldo]
```

---

## Proteção de Rotas — Resumo

| Rota | Acesso | Verificação |
|------|--------|-------------|
| `/` · `/login` · `/request-access` | Público | Nenhuma |
| `/_next/*` · `/api/auth/*` · `/api/stats` | Ignorado pelo proxy | Nenhuma |
| `/dashboard` · `/consultation/*` · `/result/*` · `/history` · `/plans` · `/settings` | Autenticado | JWT válido |
| `/console/*` | Admin | JWT + role `admin` ou `master` |

---

## Componentes de UI — Padrão por Contexto

```mermaid
flowchart LR
    subgraph APP["(app)/ — fluxo de trabalho"]
        AS[AppSheet\npainel lateral\npreserva contexto]
    end

    subgraph ADMIN["(admin)/console/ — ações pontuais"]
        AD[AppDialog\nmodal centrado\ncompacto]
    end

    AS -->|criar paciente\neditar dados| FW[Formulários de fluxo]
    AD -->|criar usuário\nconfirmar exclusão| PA[Ações administrativas]
```
