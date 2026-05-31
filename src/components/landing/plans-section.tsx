'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Check, ArrowRight, Bell } from 'lucide-react'
import { PlanInterestDialog } from '@/components/landing/plan-interest-dialog'
import type { PlanInterestPlan } from '@/lib/schemas'

const EXPERIMENTAL_FEATURES = [
  'Gravação de voz no atendimento',
  'Transcrição automática por IA',
  'Anamnese estruturada gerada por IA',
  'Gestão de pacientes',
  'Histórico de consultas',
  'Exportação de relatório',
]

function NotifyButton({ plan, onClick }: { plan: string; onClick: () => void }) {
  return (
    <Button
      variant="outline"
      size="lg"
      className="w-full h-12 gap-2 border-border hover:border-violet-500/40 hover:text-foreground"
      onClick={onClick}
    >
      <Bell className="h-4 w-4" />
      Quero ser avisado
    </Button>
  )
}

const fadeInUp = (delay = 0) => ({
  initial: { opacity: 0, y: 32 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5, ease: 'easeOut' as const, delay },
})

export function PlansSection() {
  const [dialogPlan, setDialogPlan] = useState<PlanInterestPlan | null>(null)

  return (
    <section id="planos" className="py-24 px-6 relative overflow-hidden">
      {/* Ambient glow — só no dark */}
      <div className="hidden dark:block absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-violet-600/6 rounded-full blur-[140px]" />
      </div>

      <div className="max-w-5xl mx-auto">
        {/* Overline */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3 mb-8"
        >
          <span className="text-xs text-primary tracking-widest uppercase font-medium">
            planos
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h2
          {...fadeInUp(0.08)}
          className="text-4xl lg:text-5xl font-black leading-tight tracking-tight mb-4"
        >
          <span className="text-foreground">Comece grátis,</span>
          <br />
          <span className="text-primary">
            cresça quando quiser
          </span>
        </motion.h2>

        <motion.p
          {...fadeInUp(0.14)}
          className="text-muted-foreground text-lg mb-16 max-w-xl"
        >
          Acesso experimental gratuito enquanto refinamos o produto com você.
        </motion.p>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">

          {/* Experimental */}
          <motion.div
            {...fadeInUp(0.1)}
            className="relative rounded-2xl border border-border bg-card p-8 flex flex-col"
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Experimental</p>
                <p className="text-3xl font-black text-foreground">Grátis</p>
              </div>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 shrink-0 mt-1">
                Beta
              </span>
            </div>

            <p className="text-sm text-muted-foreground mb-8">
              Acesso completo via solicitação. Ideal para profissionais em fase de avaliação.
            </p>

            <ul className="space-y-3 mb-10 flex-1">
              {EXPERIMENTAL_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm text-foreground/80">
                  <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>

            <Link href="/login?mode=solicitar" className="block">
              <Button
                size="lg"
                className="w-full h-auto min-h-12 py-2 gap-2 whitespace-normal text-center leading-tight text-white border-0 hover:opacity-90 transition-opacity"
                style={{ background: 'var(--gradient-brand)' }}
              >
                Solicitar acesso gratuito
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </motion.div>

          {/* Profissional */}
          <motion.div
            {...fadeInUp(0.2)}
            className="relative rounded-2xl border border-violet-500/40 p-8 flex flex-col ring-1 ring-violet-500/20"
            style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 6%, transparent) 0%, color-mix(in srgb, #06B6D4 4%, transparent) 100%)',
            }}
          >
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span
                className="text-xs font-semibold px-4 py-1.5 rounded-full text-white whitespace-nowrap"
                style={{ background: 'var(--gradient-brand)' }}
              >
                Popular
              </span>
            </div>

            <div className="flex items-start justify-between mb-6 mt-2">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Profissional</p>
                <p className="text-3xl font-black text-foreground">Em breve</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-8">
              Tudo do Experimental com melhorias baseadas no feedback dos usuários beta.
            </p>

            <ul className="space-y-3 mb-10 flex-1">
              {EXPERIMENTAL_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm text-foreground/80">
                  <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>

            <NotifyButton plan="Profissional" onClick={() => setDialogPlan('profissional')} />
          </motion.div>

          {/* Gestão & Clínicas */}
          <motion.div
            {...fadeInUp(0.3)}
            className="relative rounded-2xl border border-border bg-card p-8 flex flex-col"
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Gestão & Clínicas</p>
                <p className="text-3xl font-black text-foreground">Em breve</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-8">
              Solução completa para clínicas e equipes. Múltiplos profissionais, relatórios avançados e integrações.
            </p>

            <div className="flex-1 flex items-center justify-center py-10">
              <p className="text-sm text-muted-foreground/60 text-center leading-relaxed">
                Funcionalidades em definição.<br />
                Cadastre-se para ser o primeiro a saber.
              </p>
            </div>

            <NotifyButton plan="Gestão & Clínicas" onClick={() => setDialogPlan('gestao-clinicas')} />
          </motion.div>

        </div>
      </div>

      {dialogPlan && (
        <PlanInterestDialog
          plan={dialogPlan}
          open={dialogPlan !== null}
          onOpenChange={(open) => { if (!open) setDialogPlan(null) }}
        />
      )}
    </section>
  )
}
