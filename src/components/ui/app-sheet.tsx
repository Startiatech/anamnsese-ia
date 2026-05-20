'use client'

import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'

interface AppSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Chamado ao confirmar o cancelamento — use para resetar estado interno antes de fechar */
  onCancel?: () => void
  title: string
  description?: string
  icon?: React.ReactNode
  /** id do <form> que o botão de submit deve referenciar via form= */
  formId?: string
  submitLabel?: string
  submitDisabled?: boolean
  /** Oculta o rodapé com botões de ação (para sheets somente-leitura) */
  hideFooter?: boolean
  children: React.ReactNode
}

export function AppSheet({
  open,
  onOpenChange,
  onCancel,
  title,
  description,
  icon,
  formId,
  submitLabel = 'Salvar',
  submitDisabled = false,
  hideFooter = false,
  children,
}: AppSheetProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [flashCancel, setFlashCancel] = useState(false)

  function handleInteractOutside(e: Event) {
    e.preventDefault()
    setFlashCancel(true)
    cancelRef.current?.focus()
    setTimeout(() => setFlashCancel(false), 600)
  }

  function handleCancel() {
    onCancel?.()
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="p-0 flex flex-col overflow-hidden rounded-tl-2xl rounded-bl-2xl"
        onInteractOutside={handleInteractOutside}
        onEscapeKeyDown={handleCancel}
      >
        {/* Header com bg diferenciado */}
        <div className="px-6 py-5 border-b border-border pr-14 shrink-0 bg-primary/[0.08] dark:bg-primary/[0.06]">
          <div className="flex items-center gap-3 mb-1">
            {icon && (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-primary/15 dark:bg-primary/10 border border-primary/30 dark:border-primary/25">
                {icon}
              </div>
            )}
            <SheetTitle className="text-base font-semibold">{title}</SheetTitle>
          </div>
          {description && (
            <SheetDescription className={cn('text-xs text-muted-foreground', icon && 'pl-11')}>
              {description}
            </SheetDescription>
          )}
        </div>

        {/* Conteúdo scrollável */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {children}
        </div>

        {/* Footer com ações */}
        {!hideFooter && <div className="px-6 py-4 border-t border-border flex gap-2 justify-end shrink-0">
          <Button
            ref={cancelRef}
            type="button"
            variant="outline"
            onClick={handleCancel}
            className={cn(
              'transition-all duration-150',
              flashCancel && 'ring-2 ring-primary ring-offset-2 scale-105'
            )}
          >
            Cancelar
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
        </div>}
      </SheetContent>
    </Sheet>
  )
}
