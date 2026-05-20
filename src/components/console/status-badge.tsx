import { Clock, CheckCircle, XCircle } from 'lucide-react'

type RequestStatus = 'pending' | 'approved' | 'rejected'
type UserStatus = 'onboarding' | 'active' | 'blocked'
type PlanStatus = 'active' | 'inactive'
type ConsultationStatus = 'generated' | 'pending'

const REQUEST_CONFIG: Record<RequestStatus, { label: string; Icon: React.ComponentType<{ className?: string }>; className: string }> = {
  pending:  { label: 'Pendente',  Icon: Clock,        className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20' },
  approved: { label: 'Aprovado',  Icon: CheckCircle,  className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' },
  rejected: { label: 'Rejeitado', Icon: XCircle,      className: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20' },
}

const USER_CONFIG: Record<UserStatus, { label: string; className: string }> = {
  onboarding: { label: 'Onboarding', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20' },
  active:     { label: 'Ativo',      className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' },
  blocked:    { label: 'Bloqueado',  className: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20' },
}

const CONSULTATION_CONFIG: Record<ConsultationStatus, { label: string; className: string }> = {
  generated: { label: 'Gerada',   className: 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/25' },
  pending:   { label: 'Pendente', className: 'bg-muted text-muted-foreground border-border' },
}

const PLAN_CONFIG: Record<PlanStatus, { label: string; className: string }> = {
  active:   { label: 'Ativo',   className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' },
  inactive: { label: 'Inativo', className: 'bg-muted text-muted-foreground border-border' },
}

type Props =
  | { variant: 'request'; status: RequestStatus }
  | { variant: 'user'; status: UserStatus }
  | { variant: 'plan'; status: PlanStatus }
  | { variant: 'consultation'; status: ConsultationStatus }

export function StatusBadge(props: Props) {
  if (props.variant === 'request') {
    const { label, Icon, className } = REQUEST_CONFIG[props.status]
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${className}`}>
        <Icon className="h-3 w-3" />
        {label}
      </span>
    )
  }

  if (props.variant === 'consultation') {
    const { label, className } = CONSULTATION_CONFIG[props.status]
    return (
      <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${className}`}>
        {label}
      </span>
    )
  }

  if (props.variant === 'plan') {
    const { label, className } = PLAN_CONFIG[props.status]
    return (
      <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${className}`}>
        {label}
      </span>
    )
  }

  const { label, className } = USER_CONFIG[props.status]
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${className}`}>
      {label}
    </span>
  )
}
