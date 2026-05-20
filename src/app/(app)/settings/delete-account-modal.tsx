'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'
import { Separator } from '@/components/ui/separator'
import { saveFeedback, scheduleAccountDeletion } from '@/server/actions/feedback'

interface DeleteAccountModalProps {
  open: boolean
  onClose: () => void
}

export function DeleteAccountModal({ open, onClose }: DeleteAccountModalProps) {
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    const promise = (async () => {
      const { feedbackId, error } = await saveFeedback({ rating: 1, message: 'Solicitado via configurações' })
      if (error || !feedbackId) throw new Error('Erro ao processar solicitação')
      const result = await scheduleAccountDeletion(feedbackId)
      if (result.error) throw new Error(result.error)
      window.location.href = '/login'
    })()

    toast.promise(promise, {
      loading: 'Aguarde...',
      success: 'Exclusão agendada. Seus dados serão removidos em 7 dias.',
      error: 'Erro ao solicitar exclusão.',
    })

    await promise.catch(() => {})
    setLoading(false)
  }

  if (!open) return null

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
          disabled={loading}
          className="absolute right-4 top-4 z-10"
        >
          <X className="h-4 w-4" />
        </Button>

        {/* Logo */}
        <div className="flex justify-center px-6 pt-6 pb-4">
          <Logo size="sm" id="delete-account" />
        </div>

        <Separator />

        {/* Conteúdo */}
        <div className="relative px-6 pt-6 pb-4 text-center overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(239,68,68,0.12) 0%, transparent 70%)' }}
          />

          <div
            className="relative inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 bg-red-500/15 dark:bg-red-500/10 border border-red-500/30 dark:border-red-500/25 shadow-[0_0_24px_rgba(239,68,68,0.15)] dark:shadow-[0_0_24px_rgba(239,68,68,0.2)]"
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="delete-account-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#F87171" />
                  <stop offset="100%" stopColor="#EF4444" />
                </linearGradient>
              </defs>
              <path d="M9 11v10a2 2 0 002 2h6a2 2 0 002-2V11" stroke="url(#delete-account-grad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 8h18" stroke="url(#delete-account-grad)" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M10 8V6a2 2 0 012-2h4a2 2 0 012 2v2" stroke="url(#delete-account-grad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="12" y1="14" x2="12" y2="19" stroke="url(#delete-account-grad)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="16" y1="14" x2="16" y2="19" stroke="url(#delete-account-grad)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>

          <h2 className="text-xl font-semibold text-foreground mb-1">Excluir conta</h2>
          <p className="text-sm text-muted-foreground">
            Em conformidade com a <span className="font-semibold text-foreground">LGPD</span>, todos os seus dados —
            pacientes, atendimentos e anamneses — serão permanentemente removidos dos nossos servidores.
          </p>
        </div>

        {/* Info 7 dias */}
        <div className="px-6 pb-4">
          <div
            className="rounded-xl px-4 py-3 text-center bg-red-500/10 dark:bg-red-500/[0.07] border border-red-500/25 dark:border-red-500/20"
          >
            <p className="text-xs text-destructive font-medium uppercase tracking-widest">
              Você tem 7 dias para cancelar esta ação
            </p>
          </div>
        </div>

        {/* Ações */}
        <div className="px-6 pb-6 flex flex-col gap-2">
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? 'Aguarde...' : 'Confirmar exclusão'}
          </Button>
          <Button variant="ghost" className="w-full" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
