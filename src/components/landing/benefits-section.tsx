'use client'

import { Clock, Target, Shield, Download, Zap, Users, LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'

function BenefitCard({
  Icon, title, description, accent, glow, size, index,
}: {
  Icon: LucideIcon
  title: string
  description: string
  accent: string
  glow: string
  size: 'sm' | 'lg'
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, ease: 'easeOut' as const, delay: index * 0.08 }}
      className="group relative rounded-2xl border border-border bg-card/40 hover:border-violet-500/30 transition-all duration-300 cursor-default"
      style={{ padding: size === 'lg' ? '2rem' : '1.25rem' }}
    >
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ boxShadow: `inset 0 0 40px ${glow}` }}
      />
      <div
        className="h-9 w-9 rounded-xl flex items-center justify-center mb-4"
        style={{ background: glow, border: `1px solid ${glow.replace('0.12', '0.3')}` }}
      >
        <Icon className={accent} style={{ width: '18px', height: '18px' }} />
      </div>
      <h3 className={`font-semibold text-foreground mb-1.5 ${size === 'lg' ? 'text-lg' : 'text-sm'}`}>{title}</h3>
      <p className={`text-muted-foreground leading-relaxed ${size === 'lg' ? 'text-sm' : 'text-xs'}`}>{description}</p>
    </motion.div>
  )
}

const BENEFITS = [
  {
    icon: Clock,
    title: 'Economize até 70% do tempo',
    description: 'Documentação que levava 15 minutos feita em menos de 2.',
    accent: 'text-cyan-700 dark:text-cyan-400',
    glow: 'rgba(6,182,212,0.12)',
  },
  {
    icon: Target,
    title: 'Estrutura padronizada',
    description: 'Todos os campos da anamnese preenchidos. Sem omissões, sem inconsistências.',
    accent: 'text-violet-600 dark:text-violet-400',
    glow: 'rgba(124,58,237,0.12)',
  },
  {
    icon: Zap,
    title: 'Zero digitação',
    description: 'Você fala, a IA escreve. Nenhuma linha digitada durante o atendimento.',
    accent: 'text-amber-600 dark:text-amber-400',
    glow: 'rgba(245,158,11,0.12)',
  },
  {
    icon: Shield,
    title: 'Dados protegidos',
    description: 'Áudio descartado após transcrição. Dados clínicos nunca expostos.',
    accent: 'text-emerald-600 dark:text-emerald-400',
    glow: 'rgba(16,185,129,0.12)',
  },
  {
    icon: Download,
    title: 'Exportação instantânea',
    description: 'PDF e DOCX prontos para qualquer sistema de prontuário.',
    accent: 'text-pink-600 dark:text-pink-400',
    glow: 'rgba(236,72,153,0.12)',
  },
  {
    icon: Users,
    title: 'Qualquer especialidade',
    description: 'Clínica geral, cardiologia, ortopedia, pediatria — a IA se adapta.',
    accent: 'text-indigo-600 dark:text-indigo-400',
    glow: 'rgba(99,102,241,0.12)',
  },
]

export function BenefitsSection() {
  return (
    <section className="py-16 px-6 relative overflow-hidden" >
      {/* Section ambient */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-violet-600/4 rounded-full blur-[150px]" />
      </div>

      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16 space-y-3"
        >
          <p className="text-xs font-semibold text-primary tracking-widest uppercase">Benefícios</p>
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground">
            Por que médicos escolhem{' '}
            <span className="text-primary">
              Anamnese IA
            </span>
          </h2>
        </motion.div>

        {/* Brickwork: 2 cols, alternating tall/short cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Col A: 3 short cards */}
          <div className="flex flex-col gap-4">
            {[BENEFITS[0], BENEFITS[2], BENEFITS[4]].map(({ icon: Icon, title, description, accent, glow }, i) => (
              <BenefitCard key={title} Icon={Icon} title={title} description={description} accent={accent} glow={glow} size="sm" index={i} />
            ))}
          </div>

          {/* Col B: 1 tall card + 2 short cards */}
          <div className="flex flex-col gap-4">
            <BenefitCard Icon={BENEFITS[1].icon} title={BENEFITS[1].title} description={BENEFITS[1].description} accent={BENEFITS[1].accent} glow={BENEFITS[1].glow} size="lg" index={1} />
            <BenefitCard Icon={BENEFITS[3].icon} title={BENEFITS[3].title} description={BENEFITS[3].description} accent={BENEFITS[3].accent} glow={BENEFITS[3].glow} size="sm" index={3} />
            <BenefitCard Icon={BENEFITS[5].icon} title={BENEFITS[5].title} description={BENEFITS[5].description} accent={BENEFITS[5].accent} glow={BENEFITS[5].glow} size="sm" index={5} />
          </div>

        </div>
      </div>
    </section>
  )
}
