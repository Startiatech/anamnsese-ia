'use client'

import { Coins } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSidebar } from '@/components/ui/sidebar'

interface SidebarCreditsProps {
  credits: number
  planQuota?: number
  bonusCredits?: number
}

export function SidebarCredits({ credits, planQuota, bonusCredits }: SidebarCreditsProps) {
  const { state } = useSidebar()
  const collapsed = state === 'collapsed'

  const isEmpty = credits === 0
  const isLow = credits > 0 && credits <= 3

  const labelColor = isEmpty
    ? 'text-destructive'
    : isLow
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-muted-foreground'

  const iconColor = isEmpty
    ? 'text-destructive'
    : isLow
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-violet-600 dark:text-violet-400'

  const barColor = isEmpty
    ? 'bg-destructive'
    : isLow
      ? 'bg-amber-600 dark:bg-amber-400'
      : 'bg-violet-600 dark:bg-violet-400'

  const label = isEmpty
    ? 'Sem créditos'
    : `${credits} crédito${credits === 1 ? '' : 's'}`

  const pct = planQuota && planQuota > 0
    ? Math.min(100, (credits / planQuota) * 100)
    : null

  if (collapsed) {
    return (
      <div className="flex justify-center mb-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-secondary transition-colors cursor-default">
              <Coins className={`h-4 w-4 ${iconColor}`} />
            </span>
          </TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      </div>
    )
  }

  return (
    <div className={`${labelColor} mb-9`}>
      {bonusCredits && bonusCredits > 0 ? (
        <div className="flex items-center gap-1.5 text-xs font-medium mb-1" style={{ background: 'var(--gradient-brand)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          <span style={{ fontSize: '9px', WebkitTextFillColor: 'initial' }}>●</span>
          {bonusCredits} crédito{bonusCredits === 1 ? '' : 's'} bônus
        </div>
      ) : null}
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-1.5 text-xs font-medium uppercase">
          <span style={{ fontSize: '9px' }}>✦</span>
          {label}
        </span>
      </div>
      {pct !== null && (
        <div className="h-0.5 w-full rounded-full bg-black/15 dark:bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}
