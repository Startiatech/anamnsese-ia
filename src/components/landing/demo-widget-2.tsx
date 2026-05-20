'use client'

import { useEffect, useRef, useState } from 'react'
import { LayoutDashboard, User, Clock, Settings, Sparkles } from 'lucide-react'

// ── Timeline ───────────────────────────────────────────────────────────────

const TOTAL = 65
// Phase start times (seconds)
const P = [0, 10, 18, 32, 42, 56] as const

// ── Static data (real copy from the app) ──────────────────────────────────

const PATIENT = {
  name: 'Ana Clara Ferreira',
  cpf: '•••.456.789-##',
  birth: '14/03/1985',
  last: '02/01/2025',
}

const TRANSCRIPT =
  'Paciente refere dor de cabeça há 3 dias, de intensidade moderada, com sensação de pressão na região frontal. Nega febre. Uso de analgésicos com alívio parcial.'

const STEPS = ['Paciente', 'Autorização', 'Áudio', 'Revisão', 'Anamnese']

const SOAP = [
  { key: 's', label: 'S · Subjetivo', text: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20'    },
  { key: 'o', label: 'O · Objetivo',  text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  { key: 'a', label: 'A · Avaliação', text: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20'   },
  { key: 'p', label: 'P · Plano',     text: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20'    },
]

const SECTIONS = [
  { tag: 'S', title: 'Subjetivo (S)', tag_cls: 'bg-blue-500/15 text-blue-400',    content: 'Cefaleia há 3 dias, intensidade moderada, pressão frontal. Nega febre. Alívio parcial com analgésicos.' },
  { tag: 'O', title: 'Objetivo (O)',  tag_cls: 'bg-emerald-500/15 text-emerald-400', content: 'PA: 128/82 mmHg · FC: 74 bpm · Ausculta s/ alterações. Dor: 5/10.' },
  { tag: 'A', title: 'Avaliação (A)', tag_cls: 'bg-amber-500/15 text-amber-400',   content: 'Cefaleia tensional (CID G44.2). Sem sinais de alarme neurológico.' },
  { tag: 'P', title: 'Plano (P)',     tag_cls: 'bg-rose-500/15 text-rose-400',     content: 'Analgésico SOS · Hidratação · Retorno em 7 dias se sem melhora.' },
]

// ── Helpers ────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}
function ease(t: number) {
  const c = clamp(t, 0, 1)
  return 1 - Math.pow(1 - c, 3)
}
function prog(elapsed: number, start: number, dur: number) {
  return ease((elapsed - start) / dur)
}

/** Opacity of panel i given global time t */
function panelOp(i: number, t: number) {
  const s = P[i]
  const e = i < P.length - 1 ? P[i + 1] : TOTAL
  const fd = 0.45
  if (i === 0) {
    if (t < e - fd) return 1
    return 1 - ease((t - (e - fd)) / fd)
  }
  if (t < s - fd) return 0
  if (t < s)       return ease((t - (s - fd)) / fd)
  if (t < e - fd)  return 1
  return 1 - ease((t - (e - fd)) / fd)
}

// ── Main component ─────────────────────────────────────────────────────────

export function DemoWidget2() {
  const rafRef  = useRef<number>(0)
  const lastRef = useRef<number | null>(null)
  const [t, setT] = useState(0)

  useEffect(() => {
    function tick(now: number) {
      if (lastRef.current === null) lastRef.current = now
      const dt = (now - lastRef.current) / 1000
      lastRef.current = now
      setT(prev => {
        const next = prev + dt
        return next >= TOTAL ? next - TOTAL : next
      })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  let phase = 0
  for (let i = 0; i < P.length; i++) { if (t >= P[i]) phase = i }

  return (
    <section className="py-16 px-6 relative">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="text-center mb-12 space-y-2">
          <p className="text-xs font-semibold text-violet-400 tracking-widest uppercase">
            Demo gerada por IA
          </p>
          <h2 className="text-2xl lg:text-3xl font-bold text-foreground">
            Cada passo do atendimento, em detalhes
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Visualização do fluxo completo — do cadastro do paciente à exportação da anamnese.
          </p>
        </div>

        <div className="relative">
          <div
            className="rounded-2xl border border-border overflow-hidden bg-card"
            style={{ boxShadow: 'var(--demo-card-shadow)' }}
          >
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <span className="w-3 h-3 rounded-full bg-red-500/60" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <span className="w-3 h-3 rounded-full bg-green-500/60" />
            </div>

            {/* App body */}
            <div className="flex" style={{ height: 460 }}>

              {/* Sidebar — hidden on narrow screens */}
              <div className="hidden sm:flex w-44 border-r border-border bg-card flex-col flex-shrink-0">
                <div className="px-4 py-4 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-[10px] font-bold">IA</span>
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      Anamnese <span className="text-violet-400">IA</span>
                    </span>
                  </div>
                </div>
                <nav className="flex-1 p-2 space-y-0.5">
                  {([
                    { Icon: LayoutDashboard, label: 'Dashboard',      active: false        },
                    { Icon: User,            label: 'Atendimento',    active: phase < 5    },
                    { Icon: Clock,           label: 'Histórico',      active: phase === 5  },
                    { Icon: Settings,        label: 'Configurações',  active: false        },
                  ] as const).map(({ Icon, label, active }) => (
                    <div
                      key={label}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ${
                        active
                          ? 'bg-violet-500/10 text-violet-400 font-medium'
                          : 'text-muted-foreground'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                      {label}
                    </div>
                  ))}
                </nav>
                <div className="px-3 py-3 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-[10px] font-bold">DR</span>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-foreground">Dr. Rafael</p>
                      <p className="text-[10px] text-muted-foreground">18 créditos</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main */}
              <div className="flex-1 flex flex-col overflow-hidden">

                {/* Step bar */}
                {phase < 5 && (
                  <div className="flex items-center gap-0 px-4 py-3 border-b border-border bg-card/50 flex-shrink-0 overflow-x-hidden">
                    {STEPS.map((name, i) => {
                      const done   = i < phase
                      const active = i === phase
                      return (
                        <div key={i} className="flex items-center min-w-0">
                          {i > 0 && (
                            <div
                              className={`h-px w-4 mx-1 flex-shrink-0 transition-colors duration-500 ${
                                done || active ? 'bg-violet-500/50' : 'bg-border'
                              }`}
                            />
                          )}
                          <div className="flex items-center gap-1 min-w-0">
                            <div
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0 transition-all duration-500 ${
                                done   ? 'bg-emerald-500 text-white' :
                                active ? 'bg-violet-600 text-white'  :
                                         'bg-border text-muted-foreground'
                              }`}
                            >
                              {done ? '✓' : i + 1}
                            </div>
                            <span
                              className={`text-[10px] whitespace-nowrap transition-colors duration-500 hidden sm:block ${
                                done   ? 'text-emerald-400' :
                                active ? 'text-violet-400 font-medium' :
                                         'text-muted-foreground'
                              }`}
                            >
                              {name}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Panels */}
                <div className="flex-1 relative overflow-hidden">
                  {([0, 1, 2, 3, 4, 5] as const).map(i => (
                    <div
                      key={i}
                      className="absolute inset-0"
                      style={{ opacity: panelOp(i, t), pointerEvents: 'none' }}
                    >
                      {i === 0 && <Phase0 pt={t}           />}
                      {i === 1 && <Phase1 pt={t - P[1]}    />}
                      {i === 2 && <Phase2 t={t} pt={t - P[2]} />}
                      {i === 3 && <Phase3 pt={t - P[3]}    />}
                      {i === 4 && <Phase4 pt={t - P[4]}    />}
                      {i === 5 && <Phase5 pt={t - P[5]}    />}
                    </div>
                  ))}
                </div>

              </div>
            </div>
          </div>

        </div>

        {/* Badge */}
        <div className="flex items-center justify-center gap-2 mt-6">
          <Sparkles className="h-3.5 w-3.5 text-violet-400" />
          <p className="text-xs text-muted-foreground">
            Demo gerada por IA · Representação do fluxo real · Dados fictícios
          </p>
        </div>

      </div>
    </section>
  )
}

// ── Phase 0 — Paciente (t = 0–10s) ────────────────────────────────────────

function Phase0({ pt }: { pt: number }) {
  const cardOp      = prog(pt, 0, 0.8)
  const showModal   = pt >= 3 && pt < 7.2
  const confirmLit  = pt >= 5.2
  const showToast   = pt >= 7.5

  return (
    <div className="p-4 h-full overflow-hidden relative">
      {/* Patient card */}
      <div
        style={{ opacity: cardOp, transform: `translateY(${(1 - cardOp) * 8}px)` }}
        className="bg-card border border-border rounded-xl p-4 max-w-xs"
      >
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-3">
          Confirmar paciente
        </p>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-violet-500/15 flex items-center justify-center flex-shrink-0">
            <User className="h-4 w-4 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{PATIENT.name}</p>
            <p className="text-[11px] text-muted-foreground">Paciente</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {([
            ['CPF',           PATIENT.cpf  ],
            ['Nascimento',    PATIENT.birth],
            ['Telefone',      '(11) 9 ••••-••••'],
            ['Último atend.', PATIENT.last ],
          ] as const).map(([label, value]) => (
            <div key={label} className="bg-muted/30 rounded-lg p-2">
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <p className="text-[11px] text-foreground font-medium mt-0.5">{value}</p>
            </div>
          ))}
        </div>
        <div
          className={`text-center text-xs py-2 rounded-lg border transition-all duration-500 ${
            confirmLit
              ? 'bg-violet-600 border-violet-500 text-white'
              : 'bg-muted/20 border-border text-muted-foreground'
          }`}
        >
          {confirmLit ? '✓ Confirmar início' : 'Confirmar e continuar →'}
        </div>
      </div>

      {/* Credit modal */}
      {showModal && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
          <div
            className="bg-card border border-border rounded-2xl p-5 w-[90%] max-w-[256px] shadow-2xl"
            style={{
              opacity:   prog(pt, 3, 0.4),
              transform: `scale(${0.94 + 0.06 * prog(pt, 3, 0.4)})`,
            }}
          >
            <p className="text-sm font-semibold text-foreground mb-1">
              Informação de Crédito
            </p>
            <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
              Ao confirmar,{' '}
              <span className="text-foreground font-semibold">1 crédito</span> será debitado.
              Este valor cobre o ciclo completo da sessão:
            </p>
            <div className="space-y-1.5 mb-4">
              {[
                'Até 3 envios de áudio por consulta',
                'Até 5 refinamentos com IA',
                'Exportação em PDF e DOCX',
              ].map(item => (
                <div key={item} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <div className="flex-1 text-center text-[11px] py-1.5 rounded-lg border border-border text-muted-foreground">
                Cancelar
              </div>
              <div
                className={`flex-1 text-center text-[11px] py-1.5 rounded-lg transition-all duration-300 ${
                  confirmLit
                    ? 'bg-violet-600 text-white'
                    : 'bg-muted/20 text-muted-foreground border border-border'
                }`}
              >
                Confirmar início
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {showToast && (
        <Toast
          text="1 crédito debitado. Atendimento iniciado."
          opacity={prog(pt, 7.5, 0.4)}
        />
      )}
    </div>
  )
}

// ── Phase 1 — Autorização (t = 10–18s, pt = 0–8) ─────────────────────────

function Phase1({ pt }: { pt: number }) {
  const panelOp_  = prog(pt, 0, 0.8)
  const checked   = pt >= 3.5
  const showBtn   = pt >= 5
  const showToast = pt >= 6.5

  return (
    <div className="p-4 h-full overflow-hidden relative">
      <div
        style={{ opacity: panelOp_, transform: `translateY(${(1 - panelOp_) * 8}px)` }}
        className="bg-card border border-border rounded-xl p-4 max-w-xs"
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-semibold text-blue-400 uppercase tracking-wider">
            LGPD
          </span>
        </div>
        <p className="text-sm font-semibold text-foreground mb-1">
          Autorização de Gravação
        </p>
        <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
          Ao continuar, você declara que o paciente foi informado sobre a gravação
          e autorizou expressamente o uso deste sistema.
        </p>

        <div
          className={`flex items-start gap-2.5 p-3 rounded-lg border transition-all duration-500 ${
            checked
              ? 'bg-violet-500/5 border-violet-500/20'
              : 'bg-muted/20 border-border'
          }`}
        >
          <div
            className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-300 ${
              checked ? 'bg-violet-600 border-violet-500' : 'border-muted-foreground/40 bg-background'
            }`}
          >
            {checked && <span className="text-white text-[9px] font-bold">✓</span>}
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Confirmo que orientei o paciente sobre a gravação e que ele autorizou
            o uso deste sistema.
          </p>
        </div>

        {showBtn && (
          <div
            className="mt-3 text-center text-xs py-2 rounded-lg bg-violet-600 text-white"
            style={{ opacity: prog(pt, 5, 0.4) }}
          >
            Continuar →
          </div>
        )}
      </div>

      {showToast && (
        <Toast text="Autorização salva." opacity={prog(pt, 6.5, 0.4)} />
      )}
    </div>
  )
}

// ── Phase 2 — Áudio (t = 18–32s, pt = 0–14) ──────────────────────────────

function Phase2({ t, pt }: { t: number; pt: number }) {
  const panelOp_     = prog(pt, 0, 0.8)
  const txProgress   = clamp((pt - 2) / 10, 0, 1)
  const displayed    = TRANSCRIPT.slice(0, Math.floor(txProgress * TRANSCRIPT.length))
  const isProcessing = pt >= 12
  const showBtn      = pt >= 13
  const showToast    = pt >= 13

  const waveHeights = Array.from({ length: 22 }, (_, i) => {
    const ph = (t * 4.5 + i * 0.65) % (Math.PI * 2)
    const v  = Math.sin(ph) * 0.4 + Math.sin(ph * 2.2 + i * 0.4) * 0.3
    return Math.round(clamp(4 + (v + 1) * 11, 3, 26))
  })

  const secs   = Math.max(0, Math.floor(pt))
  const timer  = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
  const cursor = Math.sin(t * 8) > 0 ? 1 : 0

  return (
    <div className="p-4 h-full overflow-hidden relative">
      <div
        style={{ opacity: panelOp_, transform: `translateY(${(1 - panelOp_) * 8}px)` }}
        className="space-y-3 max-w-xs"
      >
        {/* Status row */}
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              isProcessing ? 'bg-violet-400' : 'bg-red-400 animate-pulse'
            }`}
          />
          <span className={`text-xs font-medium ${isProcessing ? 'text-violet-400' : 'text-red-400'}`}>
            {isProcessing ? 'Processando...' : 'Gravando...'}
          </span>
          <span className="text-[11px] text-muted-foreground ml-auto font-mono">{timer}</span>
        </div>

        {/* Waveform */}
        {!isProcessing && (
          <div className="flex items-center gap-0.5 h-7">
            {waveHeights.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm bg-violet-400/55"
                style={{ height: h }}
              />
            ))}
          </div>
        )}

        {/* Transcript */}
        <div className="bg-muted/20 border border-border rounded-xl p-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">
            Transcrição em tempo real
          </p>
          <p className="text-[11px] text-foreground leading-relaxed font-mono min-h-[72px]">
            {displayed}
            {!isProcessing && pt >= 2 && (
              <span
                className="inline-block w-0.5 h-3 bg-violet-400 ml-0.5 align-middle"
                style={{ opacity: cursor }}
              />
            )}
          </p>
        </div>

        {showBtn && (
          <div
            className="text-center text-xs py-2 rounded-lg bg-violet-600 text-white"
            style={{ opacity: prog(pt, 13, 0.4) }}
          >
            Continuar →
          </div>
        )}
      </div>

      {showToast && (
        <Toast text="Transcrição concluída!" opacity={prog(pt, 13, 0.4)} />
      )}
    </div>
  )
}

// ── Phase 3 — Revisão SOAP (t = 32–42s, pt = 0–10) ───────────────────────

const SOAP_TIMES = [1.2, 3.0, 4.8, 6.6] as const

function Phase3({ pt }: { pt: number }) {
  const panelOp_   = prog(pt, 0, 0.8)
  const showGen    = pt >= 8
  const showToast  = pt >= 9

  return (
    <div className="p-4 h-full overflow-hidden relative">
      <div
        style={{ opacity: panelOp_, transform: `translateY(${(1 - panelOp_) * 8}px)` }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[360px]"
      >
        {/* Left: transcript — hidden on mobile (already shown in phase 2) */}
        <div className="hidden sm:block bg-muted/20 border border-border rounded-xl p-3 overflow-hidden">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
            Transcrição
          </p>
          <p className="text-[11px] text-foreground leading-relaxed font-mono">{TRANSCRIPT}</p>
        </div>

        {/* Right: SOAP pills */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            Seções SOAP
          </p>
          {SOAP.map(({ key, label, text, bg, border }, i) => {
            const appeared = pt >= SOAP_TIMES[i]
            const op = appeared ? prog(pt, SOAP_TIMES[i], 0.4) : 0
            return (
              <div
                key={key}
                style={{ opacity: op, transform: `translateY(${(1 - op) * 6}px)` }}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${bg} ${border} ${text}`}
              >
                {label}
                <span className="ml-auto opacity-50 text-[10px]">✕</span>
              </div>
            )
          })}

          {showGen && (
            <div
              className="text-center text-xs py-2 rounded-lg bg-violet-600 text-white"
              style={{ opacity: prog(pt, 8, 0.4) }}
            >
              Gerar Anamnese →
            </div>
          )}
        </div>
      </div>

      {showToast && (
        <Toast text="Anamnese gerada!" opacity={prog(pt, 9, 0.4)} />
      )}
    </div>
  )
}

// ── Phase 4 — Anamnese (t = 42–56s, pt = 0–14) ───────────────────────────

const SEC_TIMES  = [0.5, 3, 5.5, 8] as const
const EXPORTS = [
  { label: '↓ PDF',   cls: 'text-rose-400    bg-rose-500/10    border-rose-500/20'    },
  { label: '↓ DOCX',  cls: 'text-blue-400    bg-blue-500/10    border-blue-500/20'    },
  { label: '⎘ Copiar',cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
] as const

function Phase4({ pt }: { pt: number }) {
  const panelOp_  = prog(pt, 0, 0.6)
  const showExp   = pt >= 10.5
  const showFin   = pt >= 11.5
  const showModal = pt >= 12.5 && pt < 14.2
  const showToast = pt >= 13.5

  return (
    <div className="p-4 h-full overflow-hidden relative">
      <div
        style={{ opacity: panelOp_, transform: `translateY(${(1 - panelOp_) * 8}px)` }}
        className="flex gap-3 max-h-[380px]"
      >
        {/* Left: sections */}
        <div className="flex-1 space-y-2 overflow-hidden">
          {SECTIONS.map(({ tag, title, tag_cls, content }, i) => {
            const appeared = pt >= SEC_TIMES[i]
            const op = appeared ? prog(pt, SEC_TIMES[i], 0.5) : 0
            return (
              <div
                key={tag}
                style={{ opacity: op, transform: `translateY(${(1 - op) * 8}px)` }}
                className="bg-muted/20 border border-border rounded-xl p-2.5"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${tag_cls}`}>
                    {tag}
                  </div>
                  <span className="text-xs font-medium text-foreground">{title}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{content}</p>
              </div>
            )
          })}
        </div>

        {/* Right: actions */}
        <div className="w-24 flex-shrink-0 space-y-2">
          {showExp && (
            <div style={{ opacity: prog(pt, 10.5, 0.4) }} className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">
                Exportar
              </p>
              {EXPORTS.map(({ label, cls }, i) => (
                <div
                  key={label}
                  style={{ opacity: prog(pt, 10.5 + i * 0.35, 0.3) }}
                  className={`text-center text-[11px] py-1.5 rounded-lg border font-medium ${cls}`}
                >
                  {label}
                </div>
              ))}
            </div>
          )}

          {showFin && (
            <div
              className="text-center text-[11px] py-2 rounded-lg bg-violet-600 text-white"
              style={{ opacity: prog(pt, 11.5, 0.4) }}
            >
              Finalizar
            </div>
          )}
        </div>
      </div>

      {/* Finalize modal */}
      {showModal && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
          <div
            className="bg-card border border-border rounded-2xl p-4 w-[90%] max-w-[224px] shadow-2xl"
            style={{
              opacity:   prog(pt, 12.5, 0.4),
              transform: `scale(${0.94 + 0.06 * prog(pt, 12.5, 0.4)})`,
            }}
          >
            <p className="text-xs font-semibold text-foreground mb-1">Finalizar Atendimento</p>
            <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
              Esta anamnese ficará disponível no histórico do paciente.
            </p>
            <div className="flex gap-2">
              <div className="flex-1 text-center text-[11px] py-1.5 rounded-lg border border-border text-muted-foreground">
                Cancelar
              </div>
              <div className="flex-1 text-center text-[11px] py-1.5 rounded-lg bg-violet-600 text-white">
                Finalizar
              </div>
            </div>
          </div>
        </div>
      )}

      {showToast && (
        <Toast text="Atendimento finalizado." opacity={prog(pt, 13.5, 0.4)} />
      )}
    </div>
  )
}

// ── Phase 5 — Histórico (t = 56–65s, pt = 0–9) ───────────────────────────

function Phase5({ pt }: { pt: number }) {
  const panelOp_ = prog(pt, 0, 0.8)
  const showRow  = pt >= 2
  const showCard = pt >= 5

  return (
    <div className="p-4 h-full overflow-hidden relative">
      <div style={{ opacity: panelOp_ }}>
        <p className="text-sm font-semibold text-foreground mb-0.5">Histórico</p>
        <p className="text-[11px] text-muted-foreground mb-3">
          Todos os atendimentos realizados.
        </p>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-3">
          <div className="grid grid-cols-4 gap-2 px-3 py-2 border-b border-border bg-muted/20">
            {['Paciente', 'CPF', 'Data', 'Anamnese'].map(h => (
              <p key={h} className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {h}
              </p>
            ))}
          </div>
          {showRow && (
            <div
              className="grid grid-cols-4 gap-2 px-3 py-2.5 items-center"
              style={{
                opacity:   prog(pt, 2, 0.5),
                transform: `translateY(${(1 - prog(pt, 2, 0.5)) * 6}px)`,
              }}
            >
              <p className="text-xs font-medium text-foreground truncate">{PATIENT.name}</p>
              <p className="text-[11px] text-muted-foreground font-mono">{PATIENT.cpf}</p>
              <p className="text-[11px] text-muted-foreground">hoje</p>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                <span className="text-[11px] text-emerald-400 font-medium">Gerada</span>
              </div>
            </div>
          )}
        </div>

        {/* Anamnesis preview card */}
        {showCard && (
          <div
            className="bg-card border border-border rounded-xl p-3"
            style={{
              opacity:   prog(pt, 5, 0.6),
              transform: `translateY(${(1 - prog(pt, 5, 0.6)) * 8}px)`,
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-foreground">
                Anamnese — {PATIENT.name}
              </p>
              <span className="text-[10px] text-violet-400 font-medium">hoje</span>
            </div>
            {SECTIONS.map(({ tag, title, tag_cls, content }, i) => (
              <div
                key={tag}
                className="mb-2 last:mb-0"
                style={{ opacity: prog(pt, 5.2 + i * 0.5, 0.4) }}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <div className={`w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center flex-shrink-0 ${tag_cls}`}>
                    {tag}
                  </div>
                  <span className="text-[11px] font-medium text-foreground">{title}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed pl-5">{content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Shared Toast ───────────────────────────────────────────────────────────

function Toast({ text, opacity }: { text: string; opacity: number }) {
  return (
    <div
      className="absolute bottom-4 right-4"
      style={{ opacity, transform: `translateY(${(1 - opacity) * 8}px)` }}
    >
      <div className="flex items-center gap-2 bg-card border border-emerald-500/30 rounded-lg px-3 py-2 shadow-lg">
        <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
        <span className="text-xs text-foreground">{text}</span>
      </div>
    </div>
  )
}
