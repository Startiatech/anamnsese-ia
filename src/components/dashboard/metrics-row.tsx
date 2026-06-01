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
  const iconClass = 'text-primary'
  const bgClass = 'bg-primary/10 border border-primary/20'
  const metrics = [
    { label: 'Pacientes',    value: totalPatients,          icon: Users },
    { label: 'Este mês',     value: consultationsThisMonth, icon: CalendarCheck },
    { label: 'Esta semana',  value: consultationsThisWeek,  icon: TrendingUp },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {metrics.map(({ label, value, icon: Icon }) => (
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
