'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Stethoscope, FileText, ArrowRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface OnboardingIntroModalProps {
  show: boolean
  userName: string
}

const REASONS = [
  {
    icon: Stethoscope,
    color: 'rgba(124,58,237,0.15)',
    border: 'rgba(124,58,237,0.3)',
    iconColor: 'text-violet-600 dark:text-violet-400',
    label: 'Especialidade e registro profissional',
    description: 'Usados para personalizar a anamnese gerada e assinar documentos com validade clínica.',
  },
  {
    icon: FileText,
    color: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.25)',
    iconColor: 'text-amber-600 dark:text-amber-400',
    label: 'Relatórios com sua identidade',
    description: 'Cada relatório exportado conterá seus dados profissionais — CRM/CRP, especialidade e nome.',
  },
  {
    icon: ShieldCheck,
    color: 'rgba(16,185,129,0.12)',
    border: 'rgba(16,185,129,0.25)',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    label: 'Senha permanente',
    description: 'Substitua a senha provisória por uma de sua escolha para garantir a segurança da sua conta.',
  },
]

const DISMISSED_KEY = 'onboarding_intro_dismissed'

export function OnboardingIntroModal({ show, userName }: OnboardingIntroModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (show && !localStorage.getItem(DISMISSED_KEY)) setOpen(true)
  }, [show])

  function handleClose() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setOpen(false)
    router.replace('/app/settings')
  }

  if (!open) return null

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
                <linearGradient id="modal-spark" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#60A5FA" />
                  <stop offset="100%" stopColor="#22D3EE" />
                </linearGradient>
              </defs>
              <line x1="14" y1="2"    x2="14" y2="8"    stroke="url(#modal-spark)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="14" y1="20"   x2="14" y2="26"   stroke="url(#modal-spark)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="2"  y1="14"   x2="8"  y2="14"   stroke="url(#modal-spark)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="20" y1="14"   x2="26" y2="14"   stroke="url(#modal-spark)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="5.5"  y1="5.5"  x2="9.5"  y2="9.5"  stroke="url(#modal-spark)" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.8" />
              <line x1="18.5" y1="18.5" x2="22.5" y2="22.5" stroke="url(#modal-spark)" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.8" />
              <line x1="22.5" y1="5.5"  x2="18.5" y2="9.5"  stroke="url(#modal-spark)" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.8" />
              <line x1="5.5"  y1="22.5" x2="9.5"  y2="18.5" stroke="url(#modal-spark)" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.8" />
              <circle cx="14" cy="14" r="1.8" fill="url(#modal-spark)" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-1">
            Olá, {firstName}!<br />Bem-vindo ao Anamnese IA.
          </h2>
          <p className="text-sm text-muted-foreground">
            Antes de começar, precisamos de alguns dados para personalizar seus atendimentos e documentos clínicos.
          </p>
        </div>

        {/* Motivos */}
        <div className="px-6 pb-6 space-y-3">
          {REASONS.map(({ icon: Icon, color, border, iconColor, label, description }, i) => (
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
            Entendi, vamos configurar
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
