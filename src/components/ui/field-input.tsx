import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export function FieldLabel({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('text-xs text-muted-foreground/60 uppercase tracking-widest', className)}
      {...props}
    />
  )
}

export const FieldInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function FieldInput({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full bg-transparent border-0 border-b border-border px-2 pb-2',
          'text-sm text-foreground placeholder:text-muted-foreground/30',
          'focus:border-violet-500/60 outline-none transition-colors',
          '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
          className,
        )}
        {...props}
      />
    )
  },
)
