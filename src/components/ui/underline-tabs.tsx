'use client'

import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'

export interface UnderlineTab<T extends string = string> {
  id: T
  label: string
  icon?: React.ElementType
  disabled?: boolean
  disabledTitle?: string
}

interface UnderlineTabsProps<T extends string = string> {
  tabs: UnderlineTab<T>[]
  active: T
  onChange: (id: T) => void
}

export function UnderlineTabs<T extends string = string>({
  tabs,
  active,
  onChange,
}: UnderlineTabsProps<T>) {
  const activeRef = useRef<HTMLButtonElement>(null)

  // Em telas estreitas a barra rola horizontalmente (scrollbar oculta); ao
  // trocar de tab, garante que a ativa fique visivel na viewport — afordancia
  // de que ha mais tabs e impede que a ativa fique cortada fora de vista.
  useEffect(() => {
    // scrollIntoView pode nao existir em ambiente de teste (jsdom) — guarda.
    activeRef.current?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' })
  }, [active])

  return (
    <div className="border-b border-border">
      {/* flex-nowrap + overflow-x-auto: em telas estreitas a barra de tabs rola
          horizontalmente em vez de estourar a largura da pagina (que comeria o
          respiro lateral). Scrollbar oculta para nao poluir a UI. */}
      <nav className="flex flex-nowrap gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map(({ id, label, icon: Icon, disabled, disabledTitle }) => (
          <Button
            key={id}
            ref={active === id ? activeRef : undefined}
            variant="ghost"
            onClick={() => !disabled && onChange(id)}
            disabled={disabled}
            title={disabledTitle}
            className={[
              'flex shrink-0 items-center gap-2 px-4 py-2.5 h-auto -mb-px border-b-2 rounded-none whitespace-nowrap transition-colors',
              active === id
                ? 'bg-[color-mix(in_oklch,var(--primary)_12%,transparent)] text-primary border-primary font-medium rounded-t-md hover:bg-[color-mix(in_oklch,var(--primary)_20%,transparent)] hover:text-primary'
                : disabled
                  ? 'text-muted-foreground/30 border-transparent cursor-not-allowed'
                  : 'text-muted-foreground border-transparent hover:bg-[color-mix(in_oklch,var(--primary)_8%,transparent)] hover:text-primary hover:rounded-t-md',
            ].join(' ')}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {label}
          </Button>
        ))}
      </nav>
    </div>
  )
}
