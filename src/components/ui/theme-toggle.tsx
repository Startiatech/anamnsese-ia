'use client'

import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'

interface ThemeToggleProps {
  className?: string
  showLabel?: boolean
}

export function ThemeToggle({ className, showLabel = false }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return <div className={showLabel ? 'w-24 h-8' : 'w-10 h-10'} />

  const isDark = theme === 'dark'
  const label = isDark ? 'Tema claro' : 'Tema escuro'

  const button = (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-2 h-8',
        'text-muted-foreground hover:text-foreground hover:bg-accent',
        'transition-colors',
        !showLabel && 'h-10 w-10 justify-center px-0',
        className
      )}
      aria-label={label}
    >
      {isDark ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
      {showLabel && <span className="text-sm">{label}</span>}
    </button>
  )

  if (showLabel) return button

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
