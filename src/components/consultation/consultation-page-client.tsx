'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Users, Search, SearchX, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { PageHeader } from '@/components/console/page-header'
import { ROUTES } from '@/lib/routes'
import { NewPatientSheet } from './new-patient-sheet'
import { PatientRowActions } from './patient-row-actions'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Logo } from '@/components/ui/logo'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { API } from '@/lib/routes'
import { useApp } from '@/context/app-context'
import type { Patient, PatientWithStats } from '@/types'

type SortOption = 'name-asc' | 'name-desc' | 'last-consultation' | 'most-consultations'

function formatDate(iso: string): string {
  const normalized = iso.length === 10 ? iso + 'T00:00:00' : iso
  return new Date(normalized).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

interface ConsultationPageClientProps {
  initialPatients: PatientWithStats[]
  clinicComplete: boolean
}

export function ConsultationPageClient({ initialPatients, clinicComplete }: ConsultationPageClientProps) {
  const router = useRouter()
  const { credits } = useApp()
  const [patients, setPatients] = useState<PatientWithStats[]>(initialPatients)
  const [newSheetOpen, setNewSheetOpen] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [clinicDialogOpen, setClinicDialogOpen] = useState(false)
  const [sortBy, setSortBy] = useState<SortOption>('name-asc')
  const [onlyNoConsultation, setOnlyNoConsultation] = useState(false)

  const filteredPatients = useMemo(() => {
    const q = searchQuery.toLowerCase()
    const digits = searchQuery.replace(/\D/g, '')

    let result = patients.filter((p) => {
      const matchesSearch =
        !searchQuery ||
        p.name.toLowerCase().includes(q) ||
        (digits.length > 0 && p.cpf.replace(/\D/g, '').includes(digits))
      const matchesChip = !onlyNoConsultation || p.consultationCount === 0
      return matchesSearch && matchesChip
    })

    result = [...result].sort((a, b) => {
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name, 'pt-BR')
      if (sortBy === 'name-desc') return b.name.localeCompare(a.name, 'pt-BR')
      if (sortBy === 'most-consultations') return b.consultationCount - a.consultationCount
      // last-consultation: sem data vai pro final
      const aTime = a.lastConsultationAt ? new Date(a.lastConsultationAt).getTime() : 0
      const bTime = b.lastConsultationAt ? new Date(b.lastConsultationAt).getTime() : 0
      return bTime - aTime
    })

    return result
  }, [patients, searchQuery, sortBy, onlyNoConsultation])

  async function handleViewAnamnesis(patient: PatientWithStats) {
    setProcessingId(patient.id)
    const promise = fetch(API.patientLatestConsultation(patient.id))
      .then(async res => {
        if (!res.ok) throw new Error('Nenhuma anamnese encontrada.')
        return res.json() as Promise<{ id: string }>
      })

    toast.promise(promise, {
      loading: 'Aguarde...',
      success: 'Abrindo anamnese...',
      error: e => e instanceof Error ? e.message : 'Erro ao carregar anamnese.',
    })

    const consultation = await promise.catch(() => null)
    setProcessingId(null)
    if (consultation) router.push(ROUTES.resultado(consultation.id))
  }

  function handlePatientCreated(patient: Patient) {
    setPatients(prev => [{ ...patient, consultationCount: 0, lastConsultationAt: undefined }, ...prev])
  }

  function handlePatientUpdated(updated: PatientWithStats) {
    setPatients(prev => prev.map(p => p.id === updated.id ? updated : p))
  }

  function handlePatientDeleted(id: string) {
    setPatients(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Atendimento"
        description="Selecione um paciente para iniciar ou visualize os atendimentos."
        action={<Button size="lg" onClick={() => setNewSheetOpen(true)}>+ Novo paciente</Button>}
      />

      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Pacientes</h2>

        {patients.length === 0 ? (
          <div
            className="rounded-xl border border-border overflow-hidden bg-card"
          >
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 bg-violet-500/10 border border-violet-500/20"
              >
                <Users className="h-6 w-6 text-violet-400" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">Nenhum paciente cadastrado</p>
              <p className="text-xs text-muted-foreground mb-5">
                Cadastre seu primeiro paciente para começar os atendimentos.
              </p>
              <Button variant="outline" onClick={() => setNewSheetOpen(true)}>
                + Cadastrar primeiro paciente
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden bg-card">
            <div className="px-4 py-3 border-b border-border flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar paciente por nome ou CPF..."
                  className="pl-9 pr-8"
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

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setOnlyNoConsultation(v => !v)}
                  className={[
                    'px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap',
                    onlyNoConsultation
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-transparent border-border text-muted-foreground hover:text-foreground hover:border-foreground/30',
                  ].join(' ')}
                >
                  Sem atendimento
                </button>

                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                  <SelectTrigger className="h-8 w-full sm:w-44 text-xs bg-card border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name-asc">Nome A → Z</SelectItem>
                    <SelectItem value="name-desc">Nome Z → A</SelectItem>
                    <SelectItem value="last-consultation">Último atendimento</SelectItem>
                    <SelectItem value="most-consultations">Mais atendimentos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {filteredPatients.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon"><SearchX /></EmptyMedia>
                  <EmptyTitle className="text-sm font-medium">Nenhum paciente encontrado</EmptyTitle>
                  <EmptyDescription className="text-xs">Tente ajustar os filtros ou limpar a busca.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border">
                    <TableHead>Nome completo</TableHead>
                    <TableHead className="hidden sm:table-cell">Data de nascimento</TableHead>
                    <TableHead className="hidden sm:table-cell">Último atendimento</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPatients.map((patient) => (
                    <TableRow key={patient.id} className="border-border hover:bg-white/[0.02]">
                      <TableCell>
                        <p className="text-sm font-medium text-foreground">{patient.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 sm:hidden">{patient.cpf}</p>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {patient.birthDate ? formatDate(patient.birthDate) : '—'}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {patient.lastConsultationAt ? formatDate(patient.lastConsultationAt) : 'Nunca'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={processingId === patient.id}
                            onClick={() => {
                              if (credits <= 0) {
                                toast.error('Créditos insuficientes. Adquira um plano para continuar.')
                                return
                              }
                              if (!clinicComplete) {
                                setClinicDialogOpen(true)
                                return
                              }
                              setProcessingId(patient.id)
                              router.push(ROUTES.atendimentoId(patient.id))
                            }}
                          >
                            {processingId === patient.id ? 'Aguarde...' : 'Iniciar atendimento'}
                          </Button>
                          <PatientRowActions
                            patient={patient}
                            onUpdated={handlePatientUpdated}
                            onDeleted={handlePatientDeleted}
                            onViewAnamnesis={() => handleViewAnamnesis(patient)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </div>

      <NewPatientSheet
        open={newSheetOpen}
        onOpenChange={setNewSheetOpen}
        onSuccess={handlePatientCreated}
      />

      <AlertDialog open={clinicDialogOpen} onOpenChange={setClinicDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex flex-col items-center gap-4 mb-4">
              <Logo size="sm" id="clinic-required-modal" />
              <div className="w-full h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
            </div>
            <AlertDialogTitle>Complete os dados da sua clínica</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Para iniciar um atendimento é necessário preencher os dados da sua clínica.
                </p>
                <p>
                  Eles serão usados no cabeçalho dos documentos gerados (PDF e DOCX).
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => router.push(`${ROUTES.configuracoes}?force=clinica`)}>
              Ir para Configurações
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}
