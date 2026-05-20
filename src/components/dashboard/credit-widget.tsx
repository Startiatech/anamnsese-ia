'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Coins } from 'lucide-react'
import { useApp } from '@/context/app-context'

export function CreditWidget() {
  const { credits, planQuota } = useApp()
  const pct = planQuota > 0 ? Math.min(Math.round((credits / planQuota) * 100), 100) : 0
  const low = credits < 10
  const empty = credits === 0

  const iconClass = empty ? 'text-red-600 dark:text-red-400'     : low ? 'text-amber-600 dark:text-amber-400'     : 'text-emerald-600 dark:text-emerald-400'
  const bgClass   = empty ? 'bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20'     : low ? 'bg-amber-100 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20'     : 'bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20'
  const barClass  = empty ? 'bg-red-600 dark:bg-red-400'     : low ? 'bg-amber-600 dark:bg-amber-400'     : 'bg-highlight'

  return (
    <Card className={empty ? 'border-red-300 dark:border-red-500/25' : low ? 'border-amber-300 dark:border-amber-500/25' : ''}>
      <CardContent className="pt-5 pb-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Créditos disponíveis</p>
            <div className="flex items-baseline gap-1.5">
              <p className="text-2xl font-bold text-foreground">{credits}</p>
              <span className="text-xs text-muted-foreground">/ {planQuota}</span>
            </div>
          </div>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${bgClass}`}>
            <Coins className={`h-4 w-4 ${iconClass}`} />
          </div>
        </div>

        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barClass}`} style={{ width: `${pct}%` }} />
        </div>

        {empty && <p className="text-xs text-red-600 dark:text-red-400">Sem créditos — adquira mais para continuar.</p>}
        {!empty && low && <p className="text-xs text-amber-600 dark:text-amber-400">Poucos créditos restantes.</p>}
      </CardContent>
    </Card>
  )
}
