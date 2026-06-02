'use client'

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
  return (
    <div className="border-b border-border">
      <nav className="flex gap-1">
        {tabs.map(({ id, label, icon: Icon, disabled, disabledTitle }) => (
          <Button
            key={id}
            variant="ghost"
            onClick={() => !disabled && onChange(id)}
            disabled={disabled}
            title={disabledTitle}
            className={[
              'flex items-center gap-2 px-4 py-2.5 h-auto -mb-px border-b-2 rounded-none transition-colors',
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
