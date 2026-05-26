'use client'

import { Mic, Cpu, FileText } from 'lucide-react'
import { motion } from 'framer-motion'

const STEPS = [
  {
    icon: Mic,
    number: '01',
    title: 'Grave o atendimento',
    description: 'Use o microfone direto na plataforma. Converse naturalmente com o paciente enquanto a IA escuta em tempo real.',
    color: 'text-red-600 dark:text-red-400',
    border: 'border-red-500/20',
    bg: 'bg-red-500/10',
    glow: 'rgba(239,68,68,0.12)',
    dot: 'bg-red-400',
    align: 'left',
  },
  {
    icon: Cpu,
    number: '02',
    title: 'IA transcreve e estrutura',
    description: 'Whisper transcreve com precisão clínica. Claude identifica queixas, histórico, sintomas e dados relevantes automaticamente.',
    color: 'text-violet-600 dark:text-violet-400',
    border: 'border-violet-500/20',
    bg: 'bg-violet-500/10',
    glow: 'rgba(124,58,237,0.12)',
    dot: 'bg-violet-400',
    align: 'right',
  },
  {
    icon: FileText,
    number: '03',
    title: 'Anamnese pronta para exportar',
    description: 'Revise, ajuste se necessário e exporte em PDF ou DOCX. Compatível com qualquer sistema de prontuário eletrônico.',
    color: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/20',
    bg: 'bg-emerald-500/10',
    glow: 'rgba(16,185,129,0.12)',
    dot: 'bg-emerald-400',
    align: 'left',
  },
]

export function HowItWorks() {
  return (
    <section className="py-16 px-6 relative">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-20 space-y-3"
        >
          <p className="text-xs font-semibold text-primary tracking-widest uppercase">Como funciona</p>
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground">
            Do atendimento à anamnese{' '}
            <span className="text-primary">
              em 3 passos
            </span>
          </h2>
        </motion.div>

        <div className="relative">
          {/* Vertical spine */}
          <div className="hidden lg:block absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-violet-500/25 to-transparent" />

          <div className="space-y-6 lg:space-y-0">
            {STEPS.map(({ icon: Icon, number, title, description, color, border, bg, glow, dot, align }, index) => {
              const isRight = align === 'right'
              return (
                <motion.div
                  key={number}
                  initial={{ opacity: 0, x: isRight ? 48 : -48 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.55, ease: 'easeOut' as const, delay: index * 0.1 }}
                  className="relative lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center lg:min-h-[140px]"
                >
                  {/* Center dot on the spine */}
                  <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border border-border bg-background items-center justify-center z-10">
                    <div className={`w-3 h-3 rounded-full ${dot}`} style={{ boxShadow: `0 0 10px ${glow.replace('0.12', '0.5')}` }} />
                  </div>

                  {/* Content block — alternates sides */}
                  <div className={isRight ? 'lg:col-start-2' : 'lg:col-start-1'}>
                    <div className="group relative p-6 rounded-2xl border border-border bg-card/40 hover:border-violet-500/30 transition-all duration-300">
                      {/* Hover glow */}
                      <div
                        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                        style={{ boxShadow: `inset 0 0 50px ${glow}` }}
                      />
                      <div className="flex items-start gap-4">
                        <div
                          className={`shrink-0 h-11 w-11 rounded-xl border ${border} ${bg} flex items-center justify-center`}
                          style={{ boxShadow: `0 0 16px ${glow}` }}
                        >
                          <Icon className={`h-5 w-5 ${color}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-xs font-mono text-muted-foreground/40">{number}</span>
                            <h3 className="text-base font-semibold text-foreground">{title}</h3>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Empty col for spacing on alternated side */}
                  <div className={isRight ? 'lg:col-start-1 lg:row-start-1' : ''} />
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
