import { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'

export interface ResourceCardProps {
  label: string
  icon: LucideIcon
  color: string
  glow: string
  value: string
  limit: string
  pct: number
}

export function ResourceCard({ label, icon: Icon, color, glow, value, limit, pct }: ResourceCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: glow, border: `1px solid ${glow.replace('0.12', '0.25')}` }}
        >
          <Icon className={`h-3.5 w-3.5 ${color}`} />
        </div>
        <span className="text-xs text-foreground uppercase tracking-wider">{label}</span>
        <span className={`ml-auto text-xs font-mono ${color}`}>{value} / {limit}</span>
      </div>
      <div className="h-1 rounded-full bg-border overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: 'var(--gradient-brand)' }}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-1.5">Consumo: {pct.toFixed(1)}%</p>
    </Card>
  )
}
