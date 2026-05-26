'use client'

import { AppAlertDialog } from '@/components/ui/app-alert-dialog'

interface CompleteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function CompleteConfirmDialog({ open, onOpenChange, onConfirm }: CompleteConfirmDialogProps) {
  return (
    <AppAlertDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Finalizar atendimento?"
      description="A anamnese será salva no histórico do paciente e o atendimento será encerrado. Esta ação não pode ser desfeita."
      logoId="complete-modal"
      cancelLabel="Revisar antes"
      actionLabel="Finalizar"
      onConfirm={onConfirm}
    />
  )
}
