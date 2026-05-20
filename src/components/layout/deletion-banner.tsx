// src/components/layout/deletion-banner.tsx
'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cancelAccountDeletion } from '@/server/actions/feedback'

interface DeletionBannerProps {
  deletionScheduledAt: string | null
}

export function DeletionBanner({ deletionScheduledAt }: DeletionBannerProps) {
  const router = useRouter()

  if (!deletionScheduledAt) return null

  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(deletionScheduledAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  )

  async function handleCancel() {
    const promise = cancelAccountDeletion()
    toast.promise(promise, {
      loading: 'Aguarde...',
      success: 'Encerramento cancelado. Sua conta está ativa.',
      error: 'Erro ao cancelar. Tente novamente.',
    })
    const result = await promise.catch(() => null)
    if (result) router.refresh()
  }

  return (
    <div className="w-full bg-destructive/10 border-b border-destructive/20 px-4 py-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
      <div className="flex items-center gap-2 text-sm">
        <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
        <span>
          Sua conta será encerrada em{' '}
          <strong className="text-destructive">{daysLeft} dia{daysLeft !== 1 ? 's' : ''}</strong>.
          Todos os dados serão excluídos permanentemente.
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="self-end sm:self-auto shrink-0 border-destructive text-destructive hover:bg-destructive hover:text-white"
        onClick={handleCancel}
      >
        Cancelar encerramento
      </Button>
    </div>
  )
}
