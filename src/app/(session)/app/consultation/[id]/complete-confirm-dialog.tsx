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

interface CompleteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function CompleteConfirmDialog({ open, onOpenChange, onConfirm }: CompleteConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex flex-col items-center gap-4 mb-4">
            <Logo size="sm" id="complete-modal" />
            <div className="w-full h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
          </div>
          <AlertDialogTitle>Finalizar atendimento?</AlertDialogTitle>
          <AlertDialogDescription>
            A anamnese será salva no histórico do paciente e o atendimento será encerrado. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Revisar antes</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Finalizar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
