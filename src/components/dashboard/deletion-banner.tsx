'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cancelAccountDeletion } from '@/server/actions/feedback'
import { ROUTES } from '@/lib/routes'

interface DeletionBannerProps {
  deletionScheduledAt: string
}

export function DeletionBanner({ deletionScheduledAt }: DeletionBannerProps) {
  const [cancelling, setCancelling] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const daysLeft = Math.ceil(
    (new Date(deletionScheduledAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  )

  if (dismissed || daysLeft <= 0) return null

  async function handleCancel() {
    setCancelling(true)
    const promise = cancelAccountDeletion().then((r) => {
      if (r.error) throw new Error(r.error)
      window.location.reload()
    })
    toast.promise(promise, {
      loading: 'Aguarde...',
      success: 'Exclusão cancelada com sucesso.',
      error: 'Erro ao cancelar exclusão.',
    })
    await promise.catch(() => {})
    setCancelling(false)
  }

  return (
    <div
      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 rounded-xl px-4 py-3 bg-red-500/10 border border-red-500/25"
    >
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
        <p className="text-sm text-destructive">
          <span className="font-semibold">Conta agendada para exclusão.</span>{' '}
          {daysLeft === 1
            ? 'Seus dados serão removidos amanhã.'
            : `Seus dados serão removidos em ${daysLeft} dias.`}{' '}
          <a href={ROUTES.configuracoes} className="underline underline-offset-2">
            Ver detalhes
          </a>
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCancel}
          disabled={cancelling}
          className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          {cancelling ? 'Aguarde...' : 'Cancelar exclusão'}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDismissed(true)}
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
