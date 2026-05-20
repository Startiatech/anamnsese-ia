'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

export function CTASection() {
  return (
    <section className="py-16 px-6 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-violet-600/8 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Overline */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3 mb-8"
        >
          <span className="w-8 h-px bg-violet-500/40" />
          <span className="text-xs text-violet-600/80 dark:text-violet-400/70 tracking-widest uppercase font-medium">fase beta · acesso por solicitação</span>
        </motion.div>

        {/* Giant headline */}
        <motion.h2
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: 'easeOut' as const, delay: 0.08 }}
          className="text-5xl lg:text-7xl font-black leading-[1.05] tracking-tight mb-10"
        >
          <span className="text-foreground/40">Pronto para</span>
          <br />
          <span className="text-foreground">transformar seus</span>
          <br />
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(110deg, #A78BFA 0%, #38BDF8 60%, #34D399 100%)', WebkitBackgroundClip: 'text' }}
          >
            atendimentos?
          </span>
        </motion.h2>

        {/* Actions row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, delay: 0.18 }}
          className="flex flex-col sm:flex-row items-start sm:items-center gap-4"
        >
          <Link href="/login?mode=solicitar">
            <Button size="lg" className="group px-8 gap-2 text-base h-12">
              Solicitar acesso gratuito
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="lg" className="px-8 text-base h-12 border-border hover:border-violet-500/40 hover:text-foreground">
              Já tenho acesso
            </Button>
          </Link>
          <span className="text-xs text-muted-foreground/60 sm:ml-2">
            Sem cartão de crédito · Aprovação em até 24h
          </span>
        </motion.div>
      </div>
    </section>
  )
}
