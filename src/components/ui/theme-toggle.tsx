'use client'

import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface ThemeToggleProps {
  className?: string
  showLabel?: boolean
}

export function ThemeToggle({ className, showLabel = false }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return <div className={showLabel ? 'w-24 h-8' : 'w-8 h-8'} />

  const isDark = theme === 'dark'
  const label = isDark ? 'Tema claro' : 'Tema escuro'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-2 h-8',
        'text-muted-foreground hover:text-foreground hover:bg-accent',
        'transition-colors',
        !showLabel && 'w-8 justify-center px-0',
        className
      )}
      aria-label={label}
      title={label}
    >
      {isDark ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
      {showLabel && <span className="text-sm">{label}</span>}
    </button>
  )
}
