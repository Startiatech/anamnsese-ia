'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: 'easeOut' as const, delay },
})

export function HeroSection() {
  const [userCount, setUserCount] = useState(0)

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.count) setUserCount(d.count) })
      .catch(() => { })
  }, [])

  return (
    <section className="relative flex flex-col items-center justify-center px-6 pt-28 pb-16">

      {/* Ambient background glows */}
      <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-violet-600/7 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-violet-500/4 rounded-full blur-[80px]" />
      </div>

      <div className="text-center max-w-4xl mx-auto">

        {/* Annotation label */}
        <motion.div
          {...fadeUp(0)}
          className="inline-flex items-center gap-3 text-xs text-muted-foreground/60 tracking-widest uppercase font-medium mb-8"
        >
          <span className="w-8 h-px bg-violet-500/40" />
          voz · inteligência · documento
          <span className="w-8 h-px bg-violet-500/40" />
        </motion.div>

        {/* Headline */}
        <motion.h1
          {...fadeUp(0.1)}
          className="text-5xl lg:text-7xl font-black leading-[1.05] tracking-tight mb-6"
        >
          <span className="text-foreground">Anamnese clínica</span>
          <br />
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(110deg, #A78BFA 0%, #38BDF8 60%, #34D399 100%)', WebkitBackgroundClip: 'text' }}
          >
            gerada por IA
          </span>
        </motion.h1>

        <motion.p
          {...fadeUp(0.2)}
          className="text-muted-foreground text-lg leading-relaxed mb-10"
        >
          Grave o atendimento. A IA transcreve, estrutura e gera a anamnese completa.
          Você foca no paciente.
        </motion.p>

        {/* CTAs */}
        <motion.div
          {...fadeUp(0.3)}
          className="flex flex-col sm:flex-row gap-3 justify-center mb-4"
        >
          <a href="#planos" className="w-full sm:w-auto">
            <Button size="lg" className="group w-full px-8 gap-2 text-base h-12">
              Ver planos
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </a>
          <Link href="/login">
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto px-8 text-base h-12 border-border hover:border-violet-500/40 hover:text-foreground"
            >
              Já tenho acesso
            </Button>
          </Link>
        </motion.div>

        <motion.p {...fadeUp(0.35)} className="text-xs text-muted-foreground">
          Sem cartão de crédito · Aprovação em até 24h
        </motion.p>

        {/* Social proof counter */}
        <motion.div
          {...fadeUp(0.45)}
          className="mt-8 inline-flex items-center gap-2 text-xs text-muted-foreground/60"
        >
          <span className="flex -space-x-1.5">
            {['bg-violet-400', 'bg-cyan-400', 'bg-emerald-400'].map((c, i) => (
              <span
                key={i}
                className={`w-5 h-5 rounded-full border-2 border-background ${c}`}
                style={{
                  animation: `avatarPulse 2s ease-in-out infinite`,
                  animationDelay: `${i * 400}ms`,
                  opacity: 0.7,
                }}
              />
            ))}
          </span>
          <span>
            {userCount === 0
              ? 'Seja o primeiro a economizar tempo no atendimento'
              : `${userCount}+ ${userCount > 1 ? 'profissionais' : 'profissional'} já economiza${userCount > 1 ? 'm' : ''} tempo no atendimento`}
          </span>
        </motion.div>
      </div>
    </section>
  )
}
