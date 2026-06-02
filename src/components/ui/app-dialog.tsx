'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Logo } from '@/components/ui/logo'

interface AppDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  logoId: string
  /** id do <form> que o botão submit referencia via form= */
  formId?: string
  submitLabel?: string
  submitDisabled?: boolean
  cancelLabel?: string
  onCancel?: () => void
  /** Footer customizado — substitui os botões padrão quando fornecido */
  footer?: React.ReactNode
  maxWidth?: string
  children: React.ReactNode
}

export function AppDialog({
  open,
  onOpenChange,
  title,
  description,
  logoId,
  formId,
  submitLabel = 'Salvar',
  submitDisabled = false,
  cancelLabel = 'Cancelar',
  onCancel,
  footer,
  maxWidth = 'max-w-md',
  children,
}: AppDialogProps) {
  function handleCancel() {
    onCancel?.()
    onOpenChange(false)
  }

  const showFooter = footer !== undefined || !!formId

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* flex-col + max-h: header e footer fixos, miolo rolavel — garante que o
          rodape (botoes) nunca fique cortado/atras do teclado no mobile. */}
      <DialogContent className={`${maxWidth} w-[calc(100%-2rem)] p-0 gap-0 overflow-hidden flex flex-col max-h-[90vh]`}>
        <DialogHeader className="shrink-0 px-6 pt-6 pb-5 space-y-4">
          <div className="flex flex-col items-center gap-4">
            <Logo size="sm" id={logoId} />
            <div className="w-full h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
          </div>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            typeof description === 'string'
              ? <DialogDescription>{description}</DialogDescription>
              : <DialogDescription asChild><div>{description}</div></DialogDescription>
          )}
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 space-y-4">
          {children}
        </div>

        {showFooter && (
          <div className="shrink-0 px-6 py-4 border-t border-border flex flex-col-reverse gap-2 sm:flex-row sm:justify-end [&>button]:w-full sm:[&>button]:w-auto">
            {footer !== undefined ? footer : (
              <>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  {cancelLabel}
                </Button>
                {formId && (
                  <Button
                    type="submit"
                    form={formId}
                    disabled={submitDisabled}
                    style={{ background: 'var(--gradient-brand)', color: 'white' }}
                  >
                    {submitDisabled ? 'Aguarde...' : submitLabel}
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
