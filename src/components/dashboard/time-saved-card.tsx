'use client'

import { useState } from 'react'
import { Clock } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Period = 'today' | 'week' | 'month'

interface TimeSavedCardProps {
  todayCount: number
  weekCount: number
  monthCount: number
  minutesPerConsultation: number
}

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes}min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${m}min`
}

const TABS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
]

export function TimeSavedCard({ todayCount, weekCount, monthCount, minutesPerConsultation }: TimeSavedCardProps) {
  const [period, setPeriod] = useState<Period>('today')

  const countMap: Record<Period, number> = {
    today: todayCount,
    week: weekCount,
    month: monthCount,
  }

  const count = countMap[period]
  const minutes = count * minutesPerConsultation

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center border bg-blue-500/15 dark:bg-blue-500/10 border-blue-500/25 dark:border-blue-500/20">
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Tempo Poupado
            </span>
          </div>
          <div
            role="tablist"
            className="inline-flex h-7 items-center rounded-lg p-1"
            style={{ background: 'color-mix(in oklch, var(--primary) 18%, transparent)' }}
          >
            {TABS.map(tab => (
              <button
                key={tab.value}
                role="tab"
                aria-selected={period === tab.value}
                onClick={() => setPeriod(tab.value)}
                className={cn(
                  'text-xs px-2 py-1 rounded-md transition-all',
                  period === tab.value
                    ? 'bg-background text-foreground shadow'
                    : 'text-foreground/70 hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p
          className="text-3xl font-bold"
          style={{ background: 'var(--gradient-brand)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
        >
          {formatTime(minutes)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {count} consulta{count !== 1 ? 's' : ''} · {minutesPerConsultation} min cada
        </p>
      </CardContent>
    </Card>
  )
}
