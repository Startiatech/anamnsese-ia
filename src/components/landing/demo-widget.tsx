'use client'

import { useEffect, useState } from 'react'
import { Mic, Loader2, FileText, CheckCircle2 } from 'lucide-react'

const DEMO_STEPS = [
  {
    icon: Mic,
    label: 'Gravando consulta',
    detail: '"Paciente relata dor torácica há 3 dias, piora ao esforço físico..."',
    color: 'text-red-600 dark:text-red-400',
    borderColor: 'border-red-500/25',
    bg: 'bg-red-500/8',
    dot: 'bg-red-400',
    spin: false,
  },
  {
    icon: Loader2,
    label: 'Transcrevendo com Whisper',
    detail: 'Identificando: queixa principal · histórico · sintomas associados',
    color: 'text-amber-600 dark:text-amber-400',
    borderColor: 'border-amber-500/25',
    bg: 'bg-amber-500/8',
    dot: 'bg-amber-400',
    spin: true,
  },
  {
    icon: FileText,
    label: 'Gerando anamnese com Claude',
    detail: 'Estruturando: HDA · Antecedentes · Exame físico · Hipótese diagnóstica',
    color: 'text-violet-600 dark:text-violet-400',
    borderColor: 'border-violet-500/25',
    bg: 'bg-violet-500/8',
    dot: 'bg-violet-400',
    spin: false,
  },
  {
    icon: CheckCircle2,
    label: 'Anamnese pronta',
    detail: 'Pronta para revisão · Exportar PDF · Exportar DOCX',
    color: 'text-emerald-600 dark:text-emerald-400',
    borderColor: 'border-emerald-500/25',
    bg: 'bg-emerald-500/8',
    dot: 'bg-emerald-400',
    spin: false,
  },
]

const DONE_LINES = [
  { label: 'Queixa principal', value: 'Dor torácica há 3 dias' },
  { label: 'Característica', value: 'Piora ao esforço físico' },
  { label: 'Hipótese diagnóstica', value: 'Angina instável — investigar' },
  { label: 'Conduta', value: 'ECG + troponina + repouso' },
]

export function DemoWidget() {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const durations = [2800, 2200, 2800, 3500]
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => {
        setStep((s) => (s + 1) % DEMO_STEPS.length)
        setVisible(true)
      }, 300)
    }, durations[step])
    return () => clearTimeout(timer)
  }, [step])

  const current = DEMO_STEPS[step]
  const Icon = current.icon

  return (
    <section className="py-16 px-6 relative" style={{ background: 'var(--section-tray-bg)' }}>
      <div className="max-w-3xl mx-auto">

        {/* Section header */}
        <div className="text-center mb-12 space-y-2">
          <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 tracking-widest uppercase">Demo ao vivo</p>
          <h2 className="text-2xl lg:text-3xl font-bold text-foreground">
            Veja como funciona na prática
          </h2>
        </div>

        <div className="relative">
          {/* Annotation labels */}
          <div className="hidden sm:block relative h-8 mb-1">
            <div className="absolute left-0 bottom-0 flex items-center gap-1.5">
              <span className="w-4 h-px bg-cyan-400/40" />
              <span className="text-[11px] text-cyan-700/70 dark:text-cyan-400/60 tracking-wider uppercase font-mono">whisper stt</span>
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 bottom-0 flex items-center gap-1.5">
              <span className="w-4 h-px bg-violet-400/40" />
              <span className="text-[11px] text-violet-600/70 dark:text-violet-400/60 tracking-wider uppercase font-mono">claude ai</span>
            </div>
            <div className="absolute right-0 bottom-0 flex items-center gap-1.5">
              <span className="w-4 h-px bg-emerald-400/40" />
              <span className="text-[11px] text-emerald-700/70 dark:text-emerald-400/60 tracking-wider uppercase font-mono">pdf · docx</span>
            </div>
          </div>

          {/* Main demo card */}
          <div
            className="rounded-2xl border border-border overflow-hidden bg-card"
            style={{ boxShadow: 'var(--demo-card-shadow)' }}
          >
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <span className="w-3 h-3 rounded-full bg-red-500/60" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <span className="w-3 h-3 rounded-full bg-green-500/60" />
              <span className="ml-3 text-xs text-muted-foreground font-mono tracking-wide">
                anamnese-ia — atendimento em progresso
              </span>
              <div className="ml-auto flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                <span className="text-xs text-red-600 dark:text-red-400 font-medium">ao vivo</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="flex gap-1 px-4 pt-4">
              {DEMO_STEPS.map((_, i) => (
                <div
                  key={i}
                  className="h-0.5 flex-1 rounded-full transition-all duration-700"
                  style={{
                    background: i <= step
                      ? 'linear-gradient(90deg, #8B5CF6, #06B6D4)'
                      : 'color-mix(in oklch, currentColor 8%, transparent)',
                  }}
                />
              ))}
            </div>

            {/* Content */}
            <div className="grid sm:grid-cols-2 gap-0 divide-x divide-border">

              {/* Left: status */}
              <div className="p-6 space-y-4">
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Status</p>
                <div className={`transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}>
                  <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${current.borderColor} ${current.bg} mb-3`}>
                    <Icon className={`h-4 w-4 ${current.color} ${current.spin ? 'animate-spin' : ''}`} />
                    <span className={`text-sm font-medium ${current.color}`}>{current.label}</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${current.dot} ${step === 0 ? 'animate-pulse' : ''}`} />
                  </div>
                  <p className="text-sm text-muted-foreground font-mono leading-relaxed">{current.detail}</p>

                  {step === 0 && (
                    <div className="flex items-center gap-0.5 mt-4">
                      {Array.from({ length: 28 }).map((_, i) => (
                        <div key={i} className="w-1 rounded-full bg-red-400/50"
                          style={{ height: `${6 + Math.abs(Math.sin(i * 1.1)) * 16}px` }} />
                      ))}
                    </div>
                  )}

                  {step === 1 && (
                    <div className="mt-4 space-y-2">
                      {['Queixa principal...', 'Histórico...', 'Sintomas...'].map((item, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="h-1.5 rounded-full bg-amber-500/20 flex-1 overflow-hidden">
                            <div className="h-full bg-amber-400/50 rounded-full" style={{ width: `${60 + i * 15}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground font-mono">{item}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: anamnese preview */}
              <div className="p-6 space-y-4">
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Anamnese</p>
                <div className="space-y-2">
                  {DONE_LINES.map((line, i) => (
                    <div key={i} className="transition-all duration-500"
                      style={{ opacity: step >= (i <= 1 ? 2 : 3) ? 1 : 0.15 }}>
                      <p className="text-xs text-muted-foreground font-mono">{line.label}</p>
                      <p className="text-sm text-foreground font-mono">{line.value}</p>
                      <div className="mt-1 h-px bg-border" />
                    </div>
                  ))}
                </div>
                {step === 3 && (
                  <div className="flex gap-2 pt-1">
                    <span className="px-2 py-0.5 rounded text-xs border border-emerald-500/20 bg-emerald-500/8 text-emerald-400 font-medium">↓ PDF</span>
                    <span className="px-2 py-0.5 rounded text-xs border border-cyan-500/20 bg-cyan-500/8 text-cyan-400 font-medium">↓ DOCX</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom glow */}
          <div className="hidden dark:block absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-16 bg-violet-600/15 blur-[40px] rounded-full pointer-events-none" />
        </div>
      </div>
    </section>
  )
}
