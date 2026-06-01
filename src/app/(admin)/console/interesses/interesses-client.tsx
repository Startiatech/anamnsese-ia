'use client'

import { useState } from 'react'
import { Users } from 'lucide-react'
import { PageHeader } from '@/components/console/page-header'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { PlanInterest } from '@/server/repositories/plan-interest'
import type { PlanInterestPlan } from '@/lib/schemas'

type Filter = 'all' | PlanInterestPlan

const PLAN_LABELS: Record<PlanInterestPlan, string> = {
  profissional:      'Profissional',
  'gestao-clinicas': 'Gestão & Clínicas',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function InteressesClient({ interests }: { interests: PlanInterest[] }) {
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = filter === 'all'
    ? interests
    : interests.filter((i) => i.plan === filter)

  const countProfissional   = interests.filter((i) => i.plan === 'profissional').length
  const countGestaoClincias = interests.filter((i) => i.plan === 'gestao-clinicas').length

  const filters: { value: Filter; label: string; count: number }[] = [
    { value: 'all',             label: 'Todos',             count: interests.length },
    { value: 'profissional',    label: 'Profissional',      count: countProfissional },
    { value: 'gestao-clinicas', label: 'Gestão & Clínicas', count: countGestaoClincias },
  ]

  return (
    <div>
      <PageHeader
        title="Interesses em planos"
        description="Visitantes que querem ser avisados quando os planos estiverem disponíveis."
      />

      {/* Filtros */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={[
              'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap',
              filter === f.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent border-border text-muted-foreground hover:text-foreground hover:border-foreground/30',
            ].join(' ')}
          >
            {f.label}
            <span className={[
              'text-[10px] rounded px-1 py-0.5',
              filter === f.value ? 'bg-primary-foreground/20' : 'bg-muted',
            ].join(' ')}>{f.count}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Empty>
          <EmptyMedia>
            <EmptyHeader>
              <Users className="h-8 w-8 text-muted-foreground/40" />
            </EmptyHeader>
          </EmptyMedia>
          <EmptyTitle>Nenhum interesse registrado</EmptyTitle>
          <EmptyDescription>
            Quando visitantes clicarem em &quot;Quero ser avisado&quot;, aparecerão aqui.
          </EmptyDescription>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell className="text-muted-foreground">{item.email}</TableCell>
                <TableCell className="text-muted-foreground">
                  {item.phone ?? <span className="text-xs italic">Não informado</span>}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                    {PLAN_LABELS[item.plan as PlanInterestPlan] ?? item.plan}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDate(item.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
