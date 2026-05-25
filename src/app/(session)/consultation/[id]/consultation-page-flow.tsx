'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ConsultationProvider, useConsultationFlow } from '@/context/consultation-context'
import { StepIndicator } from '@/components/steps/step-indicator'
import { StepPatient } from '@/components/steps/step-patient'
import { StepResponsibility } from '@/components/steps/step-responsibility'
import { StepAudio } from '@/components/steps/step-audio'
import { StepSections } from '@/components/steps/step-sections'
import { StepAnamnesis } from '@/components/steps/step-anamnesis'
import { Button } from '@/components/ui/button'
import { User } from 'lucide-react'
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
import { debitConsultationCredit, abandonConsultation, completeConsultation } from '@/server/actions/consultation'
import { ROUTES } from '@/lib/routes'
import type { ClinicData } from '@/lib/clinic'
import { Logo } from '@/components/ui/logo'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { TrialEndModal } from '@/components/trial/trial-end-modal'
import type { Patient } from '@/types'

interface PlanFeatures {
  audioAttemptsLabel: string
  refinementsLabel: string
}

interface Professional {
  name: string
  specialty: string
  crm: string
}

interface ConsultationPageFlowProps {
  patient: Patient
  planFeatures: PlanFeatures
  audioAttemptsUsed: number
  audioAttemptsLimit: number | null
  refinementAttemptsUsed: number
  refinementAttemptsLimit: number | null
  initialTranscript: string
  lastConsultationAt: string | null
  professional: Professional
  clinic?: ClinicData
  creditsRemaining: number
  planId: string
}

interface AtendimentoFlowProps {
  patient: Patient
  audioAttemptsUsed: number
  refinementAttemptsUsed: number
  initialTranscript: string
  creditsRemaining: number
  planId: string
}

function AtendimentoFlow({
  patient,
  audioAttemptsUsed,
  refinementAttemptsUsed,
  initialTranscript,
  creditsRemaining,
  planId,
}: AtendimentoFlowProps) {
  const { state, isTranscribing } = useConsultationFlow()
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false)
  const [showTrialEndModal, setShowTrialEndModal] = useState(false)
  const [isLastCredit, setIsLastCredit] = useState(false)
  const [creditDebited, setCreditDebited] = useState(false)
  const [attemptsUsed, setAttemptsUsed] = useState(audioAttemptsUsed)
  const [activeTranscript, setActiveTranscript] = useState(initialTranscript)
  const [activeRefinementsUsed, setActiveRefinementsUsed] = useState(refinementAttemptsUsed)
  const [aiWasUsed, setAiWasUsed] = useState(initialTranscript !== '')
  useEffect(() => { toast.dismiss() }, [])
  useEffect(() => {
    if (!creditDebited) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [creditDebited])

  function handleComplete() {
    setCompleteConfirmOpen(true)
  }

  async function handleCompleteConfirmed() {
    await completeConsultation(patient.id)
    if (isLastCredit) {
      setShowTrialEndModal(true)
      return
    }
    router.push(ROUTES.atendimento)
  }

  async function handleDebit(): Promise<{ error?: string }> {
    if (creditDebited) return {}
    const promise = debitConsultationCredit(patient.id).then(result => {
      if (result.error) throw new Error(result.error)
      return result
    })
    toast.promise(promise, {
      loading: 'Aguarde...',
      success: '1 crédito debitado. Atendimento iniciado.',
      error: (err: Error) => err.message || 'Erro ao debitar crédito.',
    })
    const result = await promise.catch((err: Error) => ({ error: err.message }))
    if (!result.error) {
      setCreditDebited(true)
      setAiWasUsed(false)
      setActiveTranscript('')      // debit resets DB — clear stale transcript from previous session
      setActiveRefinementsUsed(0)  // debit resets DB — clear stale refinement count
      setAttemptsUsed(0)
      if (creditsRemaining - 1 <= 0 && planId === 'experimental') {
        setIsLastCredit(true)
      }
    }
    return result
  }

  function handleTranscriptionComplete() {
    setAttemptsUsed(prev => prev + 1)
    setAiWasUsed(true)
  }

  function handleAbandonClick() {
    setConfirmOpen(true)
  }

  function handleAbandonConfirmed() {
    if (!creditDebited) {
      router.push(ROUTES.atendimento)
      return
    }

    const refund = !aiWasUsed

    toast.promise(
      abandonConsultation(patient.id, state.step, aiWasUsed).then(() => {
        if (isLastCredit && aiWasUsed) {
          setShowTrialEndModal(true)
        } else {
          router.push(ROUTES.atendimento)
        }
      }),
      {
        loading: 'Aguarde...',
        success: refund
          ? '1 crédito devolvido. Consulta encerrada.'
          : 'Consulta encerrada.',
        error: 'Erro ao encerrar. Tente novamente.',
      }
    )
  }

  const abandonTitle = isTranscribing
    ? 'Transcrição em andamento'
    : creditDebited && !aiWasUsed
      ? 'Crédito será devolvido'
      : creditDebited
        ? 'Crédito não será devolvido'
        : 'Abandonar consulta?'

  const abandonDescription = isTranscribing
    ? 'O áudio está sendo processado. Se você abandonar agora, a transcrição em andamento será descartada e o crédito não será devolvido.'
    : creditDebited && !aiWasUsed
      ? 'Nenhum processamento de IA foi utilizado. O crédito debitado será devolvido ao seu saldo.'
      : creditDebited
        ? 'Processamento de IA já foi utilizado nesta sessão. O crédito não poderá ser devolvido.'
        : 'Tem certeza que deseja encerrar esta consulta? O paciente selecionado não será alterado.'

  return (
    <>
      <AlertDialog open={completeConfirmOpen} onOpenChange={setCompleteConfirmOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex flex-col items-center gap-4 mb-4">
              <Logo size="sm" id="complete-modal" />
              <div className="w-full h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
            </div>
            <AlertDialogTitle>Finalizar atendimento?</AlertDialogTitle>
            <AlertDialogDescription>
              A anamnese será salva no histórico do paciente e o atendimento será encerrado. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Revisar antes</AlertDialogCancel>
            <AlertDialogAction onClick={handleCompleteConfirmed}>
              Finalizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex flex-col items-center gap-4 mb-4">
              <Logo size="sm" id="abandon-modal" />
              <div className="w-full h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
            </div>
            <AlertDialogTitle>{abandonTitle}</AlertDialogTitle>
            <AlertDialogDescription>{abandonDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar consulta</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleAbandonConfirmed}
            >
              Abandonar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-col h-screen">
        {/* Topbar */}
        <header className="h-14 border-b border-border bg-card shrink-0 flex items-center justify-between px-6 z-40">
          <Logo size="md" id="session" />
          <ThemeToggle />
        </header>

        {/* Mobile strip — patient info + step indicator + abandon (visible only below md) */}
        <div className="md:hidden border-b border-border bg-card/40 px-4 py-3 space-y-3 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-violet-500/10 border border-violet-500/20">
                <User className="h-4 w-4 text-violet-400" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{patient.name}</p>
                <p className="text-xs text-muted-foreground">Atendimento em curso</p>
              </div>
            </div>
            <Button
              size="sm"
              className="shrink-0 bg-red-600 hover:bg-red-700 text-white shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              onClick={handleAbandonClick}
            >
              Abandonar
            </Button>
          </div>
          <StepIndicator currentStep={state.step} orientation="horizontal" />
        </div>

        {/* Body */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Sidebar — hidden on mobile */}
          <aside className="hidden md:flex w-64 shrink-0 border-r border-border bg-card/40 flex-col p-6 gap-8">
            {/* Patient info */}
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-violet-500/10 border border-violet-500/20"
              >
                <User className="h-5 w-5 text-violet-400" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{patient.name}</p>
                <p className="text-xs text-muted-foreground">Atendimento em curso</p>
              </div>
            </div>

            {/* Step indicator */}
            <StepIndicator currentStep={state.step} orientation="vertical" />

            {/* Abandonar */}
            <div className="mt-auto">
              <Button
                size="lg"
                className="w-full bg-red-600 hover:bg-red-700 text-white shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                onClick={handleAbandonClick}
              >
                Abandonar consulta
              </Button>
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 flex flex-col">
            <div className={`w-full mx-auto ${state.step === 5 ? 'max-w-6xl' : 'max-w-4xl'}`}>
              {state.step === 1 && (
                <StepPatient
                  onDebit={handleDebit}
                />
              )}
              {state.step === 2 && <StepResponsibility patientId={patient.id} />}
              {state.step === 3 && (
                <StepAudio
                  patientId={patient.id}
                  audioAttemptsUsed={attemptsUsed}
                  initialTranscript={activeTranscript}
                  onTranscriptionComplete={handleTranscriptionComplete}
                />
              )}
              {state.step === 4 && <StepSections />}
              {state.step === 5 && (
                <StepAnamnesis
                  patientId={patient.id}
                  onComplete={handleComplete}
                  refinementAttemptsUsed={activeRefinementsUsed}
                />
              )}
            </div>
          </div>
        </div>
      </div>
      <TrialEndModal open={showTrialEndModal} />
    </>
  )
}

export function ConsultationPageFlow({
  patient,
  planFeatures,
  audioAttemptsUsed,
  audioAttemptsLimit,
  refinementAttemptsUsed,
  refinementAttemptsLimit,
  initialTranscript,
  lastConsultationAt,
  professional,
  clinic,
  creditsRemaining,
  planId,
}: ConsultationPageFlowProps) {
  return (
    <ConsultationProvider
      initialPatient={patient}
      initialTranscript={initialTranscript}
      planFeatures={planFeatures}
      professional={professional}
      clinic={clinic}
      audioAttemptsLimit={audioAttemptsLimit}
      refinementAttemptsLimit={refinementAttemptsLimit}
      lastConsultationAt={lastConsultationAt}
    >
      <AtendimentoFlow
        patient={patient}
        audioAttemptsUsed={audioAttemptsUsed}
        refinementAttemptsUsed={refinementAttemptsUsed}
        initialTranscript={initialTranscript}
        creditsRemaining={creditsRemaining}
        planId={planId}
      />
    </ConsultationProvider>
  )
}
