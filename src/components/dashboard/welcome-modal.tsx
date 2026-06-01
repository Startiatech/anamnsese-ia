'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Mic, FileText, Brain, ArrowRight, X, UserPlus, PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface WelcomeModalProps {
  show: boolean
  userName: string
}

const STEPS = [
  {
    icon: UserPlus,
    color: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.25)',
    iconColor: 'text-amber-600 dark:text-amber-400',
    label: 'Cadastre o paciente',
    description: 'Cadastre/selecione um paciente para um atendimento.',
  },
  {
    icon: Mic,
    color: 'rgba(124,58,237,0.15)',
    border: 'rgba(124,58,237,0.3)',
    iconColor: 'text-violet-600 dark:text-violet-400',
    label: 'Grave a consulta',
    description: 'Inicie um atendimento e envie o áudio da consulta gravada',
  },
  {
    icon: Brain,
    color: 'rgba(6,182,212,0.12)',
    border: 'rgba(6,182,212,0.25)',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    label: 'IA transcreve e analisa',
    description: 'A IA transcreve o áudio e estrutura as informações clinicamente relevantes.',
  },
  {
    icon: PenLine,
    color: 'rgba(236,72,153,0.12)',
    border: 'rgba(236,72,153,0.25)',
    iconColor: 'text-pink-600 dark:text-pink-400',
    label: 'Refine se necessário',
    description: 'Refine a anamnese gerada se necessário.',
  },
  {
    icon: FileText,
    color: 'rgba(16,185,129,0.12)',
    border: 'rgba(16,185,129,0.25)',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    label: 'Relatório gerado',
    description: 'Receba uma anamnese estruturada pronta para exportar em PDF ou DOCX.',
  },
]

const DISMISSED_KEY = 'welcome_modal_dismissed'

export function WelcomeModal({ show, userName }: WelcomeModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (show && !localStorage.getItem(DISMISSED_KEY)) setOpen(true)
  }, [show])

  function handleClose() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setOpen(false)
    router.replace('/app/dashboard')
  }

  if (!open || !mounted) return null

  const firstName = userName.split(' ')[0]

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden bg-card border border-primary/25"
      >
        {/* Fechar */}
        <Button variant="ghost" size="icon" onClick={handleClose} className="absolute right-4 top-4 z-10">
          <X className="h-4 w-4" />
        </Button>

        {/* Header */}
        <div className="px-6 pt-8 pb-6 text-center">
          <div
            className="relative inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)' }}
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="welcome-spark" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#60A5FA" />
                  <stop offset="100%" stopColor="#22D3EE" />
                </linearGradient>
              </defs>
              <line x1="14" y1="2"    x2="14" y2="8"    stroke="url(#welcome-spark)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="14" y1="20"   x2="14" y2="26"   stroke="url(#welcome-spark)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="2"  y1="14"   x2="8"  y2="14"   stroke="url(#welcome-spark)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="20" y1="14"   x2="26" y2="14"   stroke="url(#welcome-spark)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="5.5"  y1="5.5"  x2="9.5"  y2="9.5"  stroke="url(#welcome-spark)" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.8" />
              <line x1="18.5" y1="18.5" x2="22.5" y2="22.5" stroke="url(#welcome-spark)" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.8" />
              <line x1="22.5" y1="5.5"  x2="18.5" y2="9.5"  stroke="url(#welcome-spark)" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.8" />
              <line x1="5.5"  y1="22.5" x2="9.5"  y2="18.5" stroke="url(#welcome-spark)" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.8" />
              <circle cx="14" cy="14" r="1.8" fill="url(#welcome-spark)" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-1">
            Bem-vindo, {firstName}!
          </h2>
          <p className="text-sm text-muted-foreground">
            Sua conta está pronta. Veja como funciona o fluxo de atendimento.
          </p>
        </div>

        {/* Steps */}
        <div className="px-6 pb-6 space-y-3">
          {STEPS.map(({ icon: Icon, color, border, iconColor, label, description }, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-xl p-3"
              style={{ background: color, border: `1px solid ${border}` }}
            >
              <div className="shrink-0 mt-0.5">
                <Icon className={`h-4 w-4 ${iconColor}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="px-6 pb-6">
          <Button
            onClick={handleClose}
            className="w-full gap-2"
            style={{ background: 'var(--gradient-brand)', color: 'white' }}
          >
            Começar primeiro atendimento
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
