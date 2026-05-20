'use client'

import { useState } from 'react'
import { useConsultationFlow } from '@/context/consultation-context'
import { Button } from '@/components/ui/button'
import { CreditInfoModal } from '@/components/consultation/credit-info-modal'
import { User } from 'lucide-react'

function formatDate(iso: string): string {
  const normalized = iso.length === 10 ? iso + 'T00:00:00' : iso
  return new Date(normalized).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

interface StepPatientProps {
  onDebit: () => Promise<{ error?: string }>
}

export function StepPatient({ onDebit }: StepPatientProps) {
  const { state, nextStep, planFeatures, lastConsultationAt } = useConsultationFlow()
  const { audioAttemptsLabel, refinementsLabel } = planFeatures
  const { patient } = state
  const [creditModalOpen, setCreditModalOpen] = useState(false)

  function handleConfirmAndContinue() {
    setCreditModalOpen(true)
  }

  async function handleCreditConfirmed() {
    const result = await onDebit()
    if (result.error) return
    nextStep()
  }

  if (!patient) {
    return (
      <div className="flex items-center justify-center py-10">
        <p className="text-sm text-muted-foreground">Carregando dados do paciente...</p>
      </div>
    )
  }

  return (
    <>
      <CreditInfoModal
        open={creditModalOpen}
        onOpenChange={setCreditModalOpen}
        audioAttemptsLabel={audioAttemptsLabel}
        refinementsLabel={refinementsLabel}
        onConfirm={handleCreditConfirmed}
      />

      <div className="flex flex-col md:flex-row md:gap-8 md:items-start">
        {/* Coluna principal */}
        <div className="flex-1 min-w-0 space-y-6">
          <div>
            <h2 className="text-lg font-semibold">Confirmar paciente</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Verifique os dados antes de iniciar o atendimento.</p>
          </div>

          <div className="rounded-xl border border-border p-5 space-y-5 bg-card">
            {/* Nome + ícone */}
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-violet-500/10 border border-violet-500/20"
              >
                <User className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{patient.name}</p>
                <p className="text-xs text-muted-foreground">Paciente</p>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px w-full bg-border" />

            {/* Grid de dados */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              {patient.cpf && (
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">CPF</p>
                  <p className="text-sm text-foreground">{patient.cpf}</p>
                </div>
              )}
              {patient.birthDate && (
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Nascimento</p>
                  <p className="text-sm text-foreground">{formatDate(patient.birthDate)}</p>
                </div>
              )}
              {patient.phone && (
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Telefone</p>
                  <p className="text-sm text-foreground">{patient.phone}</p>
                </div>
              )}
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Último atendimento</p>
                <p className="text-sm text-foreground">
                  {lastConsultationAt ? formatDate(lastConsultationAt) : 'Nenhum registro'}
                </p>
              </div>
            </div>
          </div>

          <Button className="w-full sm:w-auto" onClick={handleConfirmAndContinue}>Confirmar e continuar</Button>
        </div>

        {/* Painel contextual */}
        <div className="w-full md:w-72 shrink-0 space-y-4 mt-6 md:mt-0 md:sticky md:top-4">
          <div className="rounded-xl border border-primary/15 p-5 space-y-4 bg-primary/[0.04]">
            <p className="text-xs font-bold uppercase tracking-widest text-highlight">O que acontece agora</p>
            <ul className="space-y-3">
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                <span>Ao confirmar, <span className="text-foreground font-medium">1 crédito</span> será debitado do seu saldo.</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                <span>{audioAttemptsLabel}</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                <span>{refinementsLabel}</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                Se nenhum áudio for processado, o crédito é devolvido ao encerrar.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </>
  )
}
