'use client'

import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { X, ArrowRight } from 'lucide-react'
import { ROUTES } from '@/lib/routes'
import { Button } from '@/components/ui/button'

interface NoCreditsModalProps {
  open: boolean
  onClose: () => void
}

export function NoCreditsModal({ open, onClose }: NoCreditsModalProps) {
  const router = useRouter()

  if (!open) return null

  function handleGoToPlans() {
    onClose()
    router.push(ROUTES.planos)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden bg-card border border-primary/25"
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute right-4 top-4 z-10"
        >
          <X className="h-4 w-4" />
        </Button>

        <div className="relative px-6 pt-8 pb-6 text-center overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(239,68,68,0.12) 0%, transparent 70%)' }}
          />
          <div
            className="relative inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', boxShadow: '0 0 24px var(--glow-brand)' }}
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="nocredits-spark" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#60A5FA" />
                  <stop offset="100%" stopColor="#22D3EE" />
                </linearGradient>
              </defs>
              <line x1="14" y1="2"    x2="14" y2="8"    stroke="url(#nocredits-spark)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="14" y1="20"   x2="14" y2="26"   stroke="url(#nocredits-spark)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="2"  y1="14"   x2="8"  y2="14"   stroke="url(#nocredits-spark)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="20" y1="14"   x2="26" y2="14"   stroke="url(#nocredits-spark)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="5.5"  y1="5.5"  x2="9.5"  y2="9.5"  stroke="url(#nocredits-spark)" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.8" />
              <line x1="18.5" y1="18.5" x2="22.5" y2="22.5" stroke="url(#nocredits-spark)" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.8" />
              <line x1="22.5" y1="5.5"  x2="18.5" y2="9.5"  stroke="url(#nocredits-spark)" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.8" />
              <line x1="5.5"  y1="22.5" x2="9.5"  y2="18.5" stroke="url(#nocredits-spark)" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.8" />
              <circle cx="14" cy="14" r="1.8" fill="url(#nocredits-spark)" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-1">
            Seus créditos acabaram
          </h2>
          <p className="text-sm text-muted-foreground">
            Você não possui créditos disponíveis para iniciar um novo atendimento. Faça upgrade do seu plano para continuar.
          </p>
        </div>

        <div className="px-6 pb-6 flex flex-col gap-2">
          <Button
            onClick={handleGoToPlans}
            className="w-full gap-2"
            style={{ background: 'var(--gradient-brand)', color: 'white', boxShadow: '0 0 20px var(--glow-brand)' }}
          >
            Ver planos
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" onClick={onClose} className="w-full">
            Fechar
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
