import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { formatDateTime } from '@/lib/utils'
import type { Consultation, Patient } from '@/types'
import { ArrowRight, ActivityIcon } from 'lucide-react'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'

interface RecentActivityProps {
  consultations: Consultation[]
  patients: Patient[]
}

export function RecentActivity({ consultations, patients }: RecentActivityProps) {
  const recent = [...consultations]
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    .slice(0, 5)

  const patientMap = new Map(patients.map((p) => [p.id, p]))

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Atividade recente</p>
          <Link href="/history" className="text-xs text-highlight hover:text-highlight/70 flex items-center gap-1 transition-colors">
            Histórico <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><ActivityIcon /></EmptyMedia>
              <EmptyTitle className="text-xs font-normal tracking-normal">Nenhuma atividade ainda</EmptyTitle>
              <EmptyDescription className="text-xs">Seus atendimentos aparecerão aqui.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="space-y-3">
            {recent.map((c) => {
              const patient = patientMap.get(c.patientId)
              const name = patient?.name ?? 'Paciente desconhecido'
              return (
                <div key={c.id} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 bg-violet-400/10 border-violet-400/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground font-medium truncate">{name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.createdAt ? formatDateTime(c.createdAt) : '—'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
