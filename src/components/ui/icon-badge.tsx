import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Badge de ícone padrão do projeto: quadradinho arredondado com fundo tintado
 * + ícone na cor correspondente. Referência única de cor/opacidade.
 *
 * Observação: usamos a paleta nativa do Tailwind (ex: `blue-500`) e não o token
 * `primary` porque, no Tailwind v3 deste projeto, `primary` está definido como
 * `var(--primary)` sem `<alpha-value>` — então modificadores de opacidade
 * (`bg-primary/15`) não geram CSS válido e o fundo some.
 */
type IconBadgeColor = 'blue' | 'destructive' | 'success' | 'warning'
type IconBadgeSize = 'sm' | 'md' | 'lg'

const COLOR_CLASSES: Record<IconBadgeColor, { wrapper: string; icon: string }> = {
  blue: {
    wrapper: 'bg-blue-500/15 dark:bg-blue-500/10 border-blue-500/25 dark:border-blue-500/20',
    icon: 'text-blue-600 dark:text-blue-400',
  },
  destructive: {
    wrapper: 'bg-red-500/15 dark:bg-red-500/10 border-red-500/25 dark:border-red-500/20',
    icon: 'text-destructive',
  },
  success: {
    wrapper: 'bg-emerald-500/15 dark:bg-emerald-500/10 border-emerald-500/25 dark:border-emerald-500/20',
    icon: 'text-emerald-600 dark:text-emerald-400',
  },
  warning: {
    wrapper: 'bg-amber-500/15 dark:bg-amber-500/10 border-amber-500/25 dark:border-amber-500/20',
    icon: 'text-amber-600 dark:text-amber-400',
  },
}

const SIZE_CLASSES: Record<IconBadgeSize, { wrapper: string; icon: string }> = {
  sm: { wrapper: 'w-8 h-8 rounded-lg', icon: 'h-4 w-4' },
  md: { wrapper: 'w-10 h-10 rounded-xl', icon: 'h-5 w-5' },
  lg: { wrapper: 'w-12 h-12 rounded-xl', icon: 'h-6 w-6' },
}

interface IconBadgeProps {
  icon: LucideIcon
  color?: IconBadgeColor
  size?: IconBadgeSize
  className?: string
}

export function IconBadge({ icon: Icon, color = 'blue', size = 'md', className }: IconBadgeProps) {
  const c = COLOR_CLASSES[color]
  const s = SIZE_CLASSES[size]
  return (
    <div className={cn('flex items-center justify-center shrink-0 border', s.wrapper, c.wrapper, className)}>
      <Icon className={cn(s.icon, c.icon)} />
    </div>
  )
}
