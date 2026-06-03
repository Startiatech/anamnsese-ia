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

interface AppAlertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  logoId: string
  /** Texto do botao de acao (destaque). */
  actionLabel?: string
  /** Texto do botao de cancelamento. */
  cancelLabel?: string
  /** Variante visual do botao de acao. */
  actionVariant?: 'default' | 'destructive'
  /** Disabled para o botao de acao. */
  actionDisabled?: boolean
  onConfirm?: () => void
  /** Footer customizado — substitui o par cancel/action padrao. */
  footer?: React.ReactNode
  /** Conteudo extra entre description e footer (opcional). */
  children?: React.ReactNode
  maxWidth?: string
}

/**
 * Wrapper padronizado para AlertDialog de confirmacao.
 *
 * Garante o mesmo header (logo + separador gradiente) usado em AppDialog,
 * eliminando a duplicacao inline de Logo + div gradiente em cada confirmacao.
 *
 * Use para dialogos de confirmacao curtos (deletar, finalizar, etc.).
 * Para dialogos com formulario ou conteudo formal, use AppDialog.
 */
export function AppAlertDialog({
  open,
  onOpenChange,
  title,
  description,
  logoId,
  actionLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  actionVariant = 'default',
  actionDisabled = false,
  onConfirm,
  footer,
  children,
  maxWidth = 'max-w-md',
}: AppAlertDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className={maxWidth}
        // Sem description: escape hatch do Radix p/ silenciar o warning de a11y.
        {...(description ? {} : { 'aria-describedby': undefined })}
      >
        <AlertDialogHeader>
          <div className="flex flex-col items-center gap-4 mb-4">
            <Logo size="sm" id={logoId} />
            <div className="w-full h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
          </div>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            typeof description === 'string'
              ? <AlertDialogDescription>{description}</AlertDialogDescription>
              : <AlertDialogDescription asChild><div>{description}</div></AlertDialogDescription>
          )}
        </AlertDialogHeader>

        {children}

        <AlertDialogFooter>
          {footer !== undefined ? footer : (
            <>
              <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
              <AlertDialogAction
                onClick={onConfirm}
                disabled={actionDisabled}
                className={actionVariant === 'destructive' ? 'bg-destructive text-white hover:bg-destructive/90' : undefined}
              >
                {actionLabel}
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
