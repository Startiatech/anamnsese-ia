'use client'

import { AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog'
import { AppAlertDialog } from '@/components/ui/app-alert-dialog'

interface CreditInfoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  audioAttemptsLabel: string
  refinementsLabel: string
  onConfirm: () => void
}

export function CreditInfoModal({
  open,
  onOpenChange,
  audioAttemptsLabel,
  refinementsLabel,
  onConfirm,
}: CreditInfoModalProps) {
  return (
    <AppAlertDialog
      open={open}
      onOpenChange={onOpenChange}
      logoId="credit-modal"
      title="Informação de Crédito"
      description={
        <div className="space-y-5 text-sm pt-1">
          <p className="text-muted-foreground leading-relaxed">
            Ao confirmar, <span className="font-semibold text-foreground">1 crédito</span> será debitado.
            Este valor cobre o ciclo completo da sessão:
          </p>
          <div className="rounded-lg p-4 space-y-3 bg-primary/10 dark:bg-primary/8 border border-primary/20 dark:border-primary/15">
            <div className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-600 dark:bg-cyan-400" />
              <span className="text-sm text-foreground">{audioAttemptsLabel}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-600 dark:bg-cyan-400" />
              <span className="text-sm text-foreground">{refinementsLabel}</span>
            </div>
          </div>
        </div>
      }
      footer={
        <>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            style={{ background: 'var(--gradient-brand)', color: 'white' }}
          >
            Confirmar início
          </AlertDialogAction>
        </>
      }
    />
  )
}
