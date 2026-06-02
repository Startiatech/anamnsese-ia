'use client'

import type { Consultation } from '@/types'

interface WeeklyChartProps {
  consultations: Consultation[]
}

const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

/**
 * Returns the ISO Monday of the week that contains `date`.
 * Monday = index 0, Sunday = index 6.
 */
function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0 = Sunday
  // Convert to Mon=0 … Sun=6
  const diff = (day === 0 ? -6 : 1 - day)
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10) // YYYY-MM-DD
}

export function WeeklyChart({ consultations }: WeeklyChartProps) {
  const today = new Date()
  const monday = getMondayOfWeek(today)

  // Build array of 7 dates: Mon … Sun
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })

  // Count consultations per day using YYYY-MM-DD key
  const countByDay: Record<string, number> = {}
  for (const c of consultations) {
    const key = (c.createdAt ?? '').slice(0, 10)
    if (key) countByDay[key] = (countByDay[key] ?? 0) + 1
  }

  const counts = weekDays.map((d) => countByDay[toDateString(d)] ?? 0)
  const maxCount = Math.max(...counts, 1) // avoid division by zero

  const todayStr = toDateString(today)

  return (
    <div className="flex items-end gap-2 h-20 sm:h-28 w-full">
      {weekDays.map((day, i) => {
        const count = counts[i]
        const heightPct = Math.round((count / maxCount) * 100)
        const isToday = toDateString(day) === todayStr
        const barHeight = `${Math.max(heightPct, 4)}%`

        return (
          <div
            key={i}
            data-testid={`day-col-${i}`}
            className="flex flex-col items-center flex-1 gap-1"
          >
            {/* Count label */}
            <span
              data-testid={`day-count-${i}`}
              className="text-xs text-muted-foreground leading-none"
            >
              {count}
            </span>

            {/* Bar */}
            <div className="w-full flex items-end" style={{ height: 'calc(100% - 32px)' }}>
              <div
                className={`w-full rounded-t transition-all ${
                  isToday
                    ? 'bg-blue-500'
                    : 'bg-blue-500/30'
                }`}
                style={{ height: barHeight }}
              />
            </div>

            {/* Day label */}
            <span
              className={`text-xs leading-none ${
                isToday ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-muted-foreground'
              }`}
            >
              {DAY_LABELS[i]}
            </span>
          </div>
        )
      })}
    </div>
  )
}
