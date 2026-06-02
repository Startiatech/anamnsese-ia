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

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-foreground text-right min-w-0 break-words">{value}</span>
    </div>
  )
}

function PlanBadge({ plan }: { plan: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
      {PLAN_LABELS[plan as PlanInterestPlan] ?? plan}
    </span>
  )
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
        <>
          {/* Mobile (<md): cards — a tabela de 5 colunas nao cabe em 375px. */}
          <div className="grid gap-3 md:hidden">
            {filtered.map((item) => (
              <div key={item.id} data-testid="interest-card" className="rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground break-words">{item.name}</p>
                    <p className="text-xs text-muted-foreground break-all">{item.email}</p>
                  </div>
                  <span className="shrink-0"><PlanBadge plan={item.plan} /></span>
                </div>
                <div className="space-y-1.5">
                  <Field label="Telefone" value={item.phone ?? <span className="text-xs italic">Não informado</span>} />
                  <Field label="Data" value={formatDate(item.created_at)} />
                </div>
              </div>
            ))}
          </div>

          {/* Tablet+ (>=md): tabela densa. */}
          <div className="hidden md:block">
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
                      <PlanBadge plan={item.plan} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(item.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
