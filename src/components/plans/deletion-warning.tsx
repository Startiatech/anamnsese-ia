'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cancelAccountDeletion } from '@/server/actions/feedback'

interface DeletionWarningProps {
  deletionScheduledAt: string
}

export function DeletionWarning({ deletionScheduledAt }: DeletionWarningProps) {
  const router = useRouter()
  const [cancelling, setCancelling] = useState(false)

  const daysLeft = Math.ceil(
    (new Date(deletionScheduledAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  )

  async function handleCancel() {
    setCancelling(true)
    const promise = cancelAccountDeletion().then((r) => {
      if (r.error) throw new Error(r.error)
      router.refresh()
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
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl p-4 bg-red-500/10 dark:bg-red-500/[0.07] border border-red-500/30 dark:border-red-500/25"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-destructive">Conta agendada para exclusão</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Seus dados serão removidos em {daysLeft} {daysLeft === 1 ? 'dia' : 'dias'}.
            Escolha um plano abaixo para continuar usando o serviço, ou cancele a exclusão.
          </p>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={handleCancel} disabled={cancelling} className="shrink-0">
        {cancelling ? 'Aguarde...' : 'Cancelar exclusão'}
      </Button>
    </div>
  )
}
