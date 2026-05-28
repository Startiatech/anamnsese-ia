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

    E -->|role: user| F[App /app/dashboard]
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

    AP --> AP1[app/dashboard/]
    AP --> AP2[app/consultation/\nnovo/]
    AP --> AP3[app/result/id/]
    AP --> AP4[app/history/]
    AP --> AP5[app/plans/]
    AP --> AP6[app/settings/tabs/]

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
    UI->>Médico: Redirect → /app/result/id
```

---

## Robustez da Gravação de Áudio

Camada de proteção contra falhas de hardware, silêncio prolongado e alucinações do Whisper. Implementada sobre `StepAudio` sem quebrar o fluxo existente.

### VAD + Wake Lock + Interrupção (client-side)

```mermaid
sequenceDiagram
    actor Médico
    participant SA as StepAudio
    participant VAD as use-silence-detection
    participant WL as use-wake-lock
    participant RI as use-recording-interruption
    participant MR as MediaRecorder

    Médico->>SA: Clica "Iniciar gravação"
    SA->>WL: acquireWakeLock()
    WL-->>SA: WakeLock ativo (tela não dorme)
    SA->>MR: recorder.start(1000)
    SA->>VAD: conecta AnalyserNode (Web Audio API)

    loop Monitoramento contínuo
        VAD->>VAD: calcula RMS do buffer de áudio
        alt RMS < 5% por 2.5s (silêncio)
            VAD->>SA: onSilence()
            SA->>MR: recorder.pause() [auto-pause]
        else Fala detectada
            VAD->>SA: onSpeech()
            SA->>MR: recorder.resume()
        end
    end

    alt Track encerrada (watchdog detecta clock-jump = suspensão)
        RI->>SA: onInterruption(reason: 'suspended' | 'mic-disconnected')
        SA->>MR: recorder.stop() [preserva segmento]
        SA-->>Médico: Alert com motivo + "áudio preservado (total acumulado)"
        alt Médico clica "Continuar gravando"
            Médico->>SA: getUserMedia direto → novo segmento appended (falha restaura 'recorded')
        else Médico clica "Transcrever"
            SA->>SA: envia cada segmento de segmentsRef separadamente
        end
    else Médico clica "Finalizar"
        Médico->>SA: handleStop()
        SA->>MR: recorder.stop()
        SA->>WL: releaseWakeLock()
        SA->>SA: envia segmentsRef (cada WebM válido) ao /api/transcribe
    end
```

### Hardenização do Whisper + Filtro de Alucinações (server-side)

```mermaid
flowchart TD
    UP[/api/transcribe — N segmentos WebM independentes] --> TS[transcribeSegments]
    TS -->|um por vez| TC[transcribeInChunks por segmento]
    TC -->|temperature: 0\nTRANSCRIPTION_PROMPT| GR[Groq whisper-large-v3]
    GR -->|texto raw por chunk| HF[filterHallucinations]
    HF -->|remove frases isoladas conhecidas\n"tchau" · "obrigado" · "legendas amara.org" ...| JOIN[junta transcrições dos segmentos]
    JOIN --> OUT[Transcrição limpa]
    OUT --> ANM[/api/anamnesis — geração de relatório]
```

**Pontos-chave:**

- VAD é nativo (Web Audio API) — sem biblioteca externa, sem custo, sem conta.
- Wake Lock silencioso: não exibe alerta; só libera quando a gravação para.
- Interrupção distingue 2 razões (`suspended`, `mic-disconnected`) via watchdog de clock-jump (não `document.hidden`, que falha na hibernação real).
- Multi-segmento: `segmentsRef: Blob[]` acumula todos os trechos; cada WebM é enviado **separadamente** ao servidor (`transcribeSegments`) e as transcrições são juntadas — concatenar os bytes produziria um WebM inválido (só o 1º segmento seria lido).
- Filtro de alucinações só remove frase quando ela está **isolada** no chunk — preserva menções legítimas.
- `temperature: 0` e `TRANSCRIPTION_PROMPT` também protegem consultas no modo upload direto.

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

## Créditos — Duas Carteiras + Estorno Simétrico

Duas carteiras independentes em `users`:

- `credits_remaining` — saldo do plano (experimental/pago). Reset para `plan.quota` em toda troca de plano (padrão SaaS).
- `bonus_credits` — cortesia/urgência. Alimentada **só** pela injeção do master. Sem ciclo.

**Regras:**

1. Débito drena `bonus_credits` primeiro, depois `credits_remaining`.
2. Cada consulta registra `debit_source` ('bonus' | 'paid') no momento do débito.
3. Estorno (abandono sem uso de IA) volta para a **mesma carteira** indicada por `debit_source`.
4. `getCredits` retorna `bonus + paid` (validações de saldo).

```mermaid
flowchart TD
    subgraph Origens["Entradas de crédito"]
        A1[Contratação/renovação de plano] -->|reset| CR[(credits_remaining)]
        A2[Master injeta cortesia] -->|add_user_bonus_credits| BC[(bonus_credits)]
    end

    subgraph Consumo["Fluxo de consulta"]
        F[StepPatient: confirma paciente] --> G[debitConsultationCredit]
        G -->|debit_user_credit RETURNS text| SRC{source}
        SRC -->|bonus| BC
        SRC -->|paid| CR
        G -->|persist debit_source| CONS[(consultations.debit_source)]
        F2[Step Audio sem transcrever] --> AB[abandonConsultation]
        AB -->|read debit_source| CONS
        AB -->|refund_user_credit p_source| REFUND{source}
        REFUND -->|bonus| BC
        REFUND -->|paid| CR
    end

    subgraph UI["Camada UI"]
        CR --> SUM[CreditRepository.getCredits<br/>bonus + paid]
        BC --> SUM
        SUM --> CTX[AppContext.credits]
        CTX --> TB[Topbar / Sidebar badge]
        BC --> SB[SidebarCredits: linha 'bonus' separada]
        CR --> SB
    end
```

**Pontos críticos:**

- `AppProvider` sincroniza `credits` via `useEffect([initialCredits])` — sem isso, navegações no App Router não refletiam mudanças.
- `consultation-page-flow` chama `refreshCredits()` após `handleDebit` e dentro do `then` de `abandonConsultation`.

---

## Proteção de Rotas — Resumo

| Rota | Acesso | Verificação |
|------|--------|-------------|
| `/` · `/login` · `/request-access` | Público | Nenhuma |
| `/_next/*` · `/api/auth/*` · `/api/stats` | Ignorado pelo proxy | Nenhuma |
| `/app/dashboard` · `/app/consultation/*` · `/app/result/*` · `/app/history` · `/app/plans` · `/app/settings` | Autenticado | JWT válido |
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

## Configurações do Console (master)

`(admin)/console/settings` — três abas:

```mermaid
flowchart LR
    P["Perfil\nNome (edit)\nEmail (read-only)\nTelefone/WhatsApp (edit)"] 
    S["Segurança\ntroca de senha"]
    A["Acessibilidade\nTabAccessibility reusada\nshowRequestCard=false"]
```

- **Perfil** → `updateMasterProfile` (Server Action, master-only) valida via `masterProfileSchema` e persiste `{ name, phone }`. Email é exibido read-only e nunca aceito na action (proteção contra mass assignment). O telefone tem peso real: o master recebe aviso de pedido de acesso no WhatsApp.
- **Acessibilidade** → reaproveita `TabAccessibility` do lado `(app)` com `showRequestCard={false}` (o master é quem recebe os pedidos, não os envia).

## Dados da Clínica

### Onboarding (3 abas obrigatórias)

```mermaid
flowchart LR
    P[Perfil] --> C[Clínica]
    C --> S[Segurança]
    S --> D[Dashboard]
```

### Gate "Iniciar atendimento"

```mermaid
flowchart TD
    U[Usuário acessa /app/consultation/novo]
    U --> Q{isClinicComplete?}
    Q -- não --> R["redirect /app/settings?force=clinica&next=/app/consultation/novo"]
    R --> F[Aba Clínica travada e visível]
    F --> S[PATCH /api/users/me]
    S --> N["window.location.href = next"]
    N --> NA[/app/consultation/novo]
    Q -- sim --> NA
```

### Upload de logo da clínica

```mermaid
sequenceDiagram
    participant U as ClinicLogoUpload
    participant API as POST /api/users/me/clinic/logo
    participant S as Supabase Storage (clinic-logos)
    participant DB as users
    U->>API: FormData(file)
    API->>API: valida MIME + size (2MB)
    API->>DB: findUserById → clinicLogoPath?
    API->>S: remove(prev path)
    API->>S: upload({userId}/{timestamp}.ext)
    S-->>API: publicUrl
    API->>DB: updateClinicLogo(url, path)
    API-->>U: { url, path }
```

### Renderização nos documentos

```mermaid
flowchart LR
    R[app/result/id/page.tsx] -->|findUserById| FU[StoredUser com clinic*]
    FU -->|monta ClinicData| EB[ExportButtons]
    EB --> PDF[generatePDFBlob]
    EB --> DOCX[generateDOCXBlob]
    PDF -->|cabeçalho + rodapé| OUT1[Blob PDF]
    DOCX -->|header + footer| OUT2[Blob DOCX]
```

## Camada E2E (Playwright)

Suite de testes end-to-end localizada em `e2e/`. Cobre LP, login, app do usuario profissional e console master nos viewports mobile/tablet/laptop/desktop.

```mermaid
graph TD
    PW[Playwright runner] -->|sobe| DEV[pnpm dev :3000]
    PW -->|global-setup| GUARD[Valida ref do banco teste]
    GUARD -->|ok| FIXTURES[Fixtures]
    FIXTURES -->|service_role| SB[(Supabase teste)]
    FIXTURES -->|JWT direto| COOKIE[Cookie anamnese_auth]
    PW -->|executa| SPECS[Specs em 4 viewports]
    SPECS --> APP[App Next.js]
    APP -->|API| SB
    SPECS -.->|mock| AI[/api/transcribe, /api/anamnesis, /api/anamnesis/refine]
    PW -->|global-teardown| CLEANUP[cleanupE2eData LIKE e2e-
## Camada E2E (Playwright)

Suite de testes end-to-end localizada em `e2e/`. Cobre LP, login, app do usuario profissional e console master nos viewports mobile/tablet/laptop/desktop.

```mermaid
graph TD
    PW[Playwright runner] -->|sobe| DEV[pnpm dev :3000]
    PW -->|global-setup| GUARD[Valida ref do banco teste]
    GUARD -->|ok| FIXTURES[Fixtures auth/seed/mocks/session]
    FIXTURES -->|service_role| SB[(Supabase teste)]
    FIXTURES -->|JWT direto| COOKIE[Cookie anamnese_auth]
    PW -->|executa| SPECS[Specs em 4 viewports]
    SPECS --> APP[App Next.js]
    APP -->|API| SB
    SPECS -.->|mock| AI[api/transcribe + anamnesis + refine]
    PW -->|global-teardown| CLEANUP[cleanupE2eData LIKE e2e-%]
    CLEANUP --> SB
```

**Pontos-chave:**
- Guard rail bloqueia execucao contra producao (whitelist do ref de teste)
- Cada spec roda nos 4 viewports declarados em `playwright.config.ts`
- IA real nunca eh chamada — `mockAiEndpoints(page)` intercepta as 3 rotas
- Cleanup automatico ao final preserva master e dados sem prefixo `e2e-`
- Specs do console usam `loginAsMasterViaCookie` (JWT programatico) para evitar rate-limit de `/api/auth/login`
