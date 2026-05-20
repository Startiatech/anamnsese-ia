'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Logo } from '@/components/ui/logo'

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
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex flex-col items-center gap-4 mb-4">
            <Logo size="sm" id="credit-modal" />
            <div className="w-full h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
          </div>
          <AlertDialogTitle className="text-xs font-bold uppercase tracking-widest text-center mt-1 text-highlight">
            Informação de Crédito
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
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
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            style={{ background: 'var(--gradient-brand)', color: 'white' }}
          >
            Confirmar início
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
