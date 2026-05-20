'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { FileText, Search, SearchX, X } from 'lucide-react'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty'
import { StatusBadge } from '@/components/console/status-badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ROUTES, API } from '@/lib/routes'
import type { Consultation, Patient } from '@/types'

const HISTORY_PAGE_SIZE = 20

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

interface HistoryClientProps {
  consultations: Consultation[]
  patientsById: Record<string, Patient>
  hasMore: boolean
}

export function HistoryClient({ consultations, patientsById, hasMore: initialHasMore }: HistoryClientProps) {
  const [items, setItems] = useState(consultations)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'generated' | 'pending'>('all')

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase()
    const digits = searchQuery.replace(/\D/g, '')
    return items.filter((c) => {
      const patient = patientsById[c.patientId]
      const name = patient?.name ?? ''
      const cpf = patient?.cpf ?? ''
      const matchesSearch =
        !searchQuery ||
        name.toLowerCase().includes(q) ||
        (digits.length > 0 && cpf.replace(/\D/g, '').includes(digits))
      const hasAnamnesis = !!c.structuredAnamnesis?.sections?.length
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'generated' && hasAnamnesis) ||
        (statusFilter === 'pending' && !hasAnamnesis)
      return matchesSearch && matchesStatus
    })
  }, [items, patientsById, searchQuery, statusFilter])

  async function loadMore() {
    setLoading(true)
    try {
      const res = await fetch(API.consultationsPage(items.length, HISTORY_PAGE_SIZE))
      const next: Consultation[] = await res.json()
      setItems((prev) => [...prev, ...next])
      setHasMore(next.length === HISTORY_PAGE_SIZE)
    } finally {
      setLoading(false)
    }
  }

  if (consultations.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><FileText /></EmptyMedia>
          <EmptyTitle className="text-sm font-medium">Nenhum atendimento realizado</EmptyTitle>
          <EmptyDescription className="text-xs">Inicie seu primeiro atendimento para ver o histórico aqui.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link href={ROUTES.atendimento}>
            <Button variant="outline" className="rounded-lg">Ir para Atendimento</Button>
          </Link>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <>
      <div className="px-5 py-3 border-b border-border flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome ou CPF..."
            className="w-full pl-9 pr-8 py-2 text-sm bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Limpar busca"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {(['all', 'generated', 'pending'] as const).map((s) => {
            const label = s === 'all' ? 'Todas' : s === 'generated' ? 'Gerada' : 'Pendente'
            const active = statusFilter === s
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={[
                  'px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap',
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent border-border text-muted-foreground hover:text-foreground hover:border-foreground/30',
                ].join(' ')}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><SearchX /></EmptyMedia>
            <EmptyTitle className="text-sm font-medium">Nenhum atendimento encontrado</EmptyTitle>
            <EmptyDescription className="text-xs">Tente ajustar os filtros ou limpar a busca.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">Paciente</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Anamnese</TableHead>
              <TableHead className="pr-5 text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((consultation) => {
              const p = patientsById[consultation.patientId]
              const hasAnamnesis = !!consultation.structuredAnamnesis?.sections?.length
              return (
                <TableRow key={consultation.id}>
                  <TableCell className="pl-5 font-medium text-foreground">
                    {p?.name ?? 'Paciente removido'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p?.cpf ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(consultation.createdAt)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge variant="consultation" status={hasAnamnesis ? 'generated' : 'pending'} />
                  </TableCell>
                  <TableCell className="pr-5">
                    <div className="flex justify-end">
                      {hasAnamnesis ? (
                        <Link href={ROUTES.resultado(consultation.id)}>
                          <Button variant="outline" size="sm" className="rounded-lg">
                            Ver anamnese
                          </Button>
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      {hasMore && (
        <div className="flex justify-center px-5 py-4 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMore}
            disabled={loading}
            className="rounded-lg"
          >
            {loading ? 'Carregando...' : 'Carregar mais'}
          </Button>
        </div>
      )}
    </>
  )
}
