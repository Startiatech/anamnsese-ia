import { Card, CardContent } from '@/components/ui/card'
import { Users, CalendarCheck, TrendingUp } from 'lucide-react'

interface MetricsRowProps {
  totalPatients: number
  consultationsThisMonth: number
  consultationsThisWeek: number
}

export function MetricsRow({
  totalPatients,
  consultationsThisMonth,
  consultationsThisWeek,
}: MetricsRowProps) {
  const metrics = [
    { label: 'Pacientes',    value: totalPatients,          icon: Users,         iconClass: 'text-violet-500 dark:text-violet-400',  bgClass: 'bg-violet-50  dark:bg-violet-400/10  border border-violet-200/60  dark:border-violet-400/20'  },
    { label: 'Este mês',     value: consultationsThisMonth, icon: CalendarCheck, iconClass: 'text-cyan-500 dark:text-cyan-400',      bgClass: 'bg-cyan-50    dark:bg-cyan-400/10    border border-cyan-200/60    dark:border-cyan-400/20'    },
    { label: 'Esta semana',  value: consultationsThisWeek,  icon: TrendingUp,    iconClass: 'text-emerald-500 dark:text-emerald-400', bgClass: 'bg-emerald-50 dark:bg-emerald-400/10 border border-emerald-200/60 dark:border-emerald-400/20' },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {metrics.map(({ label, value, icon: Icon, iconClass, bgClass }) => (
        <Card key={label}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <p className="text-2xl font-bold text-foreground">{value}</p>
              </div>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${bgClass}`}>
                <Icon className={`h-4 w-4 ${iconClass}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
