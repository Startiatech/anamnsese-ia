import type { ConsultationStep } from '@/types'

const STEP_LABELS: Record<ConsultationStep, string> = {
  1: 'Paciente',
  2: 'Autorização',
  3: 'Áudio',
  4: 'Revisão',
  5: 'Anamnese',
}

interface StepIndicatorProps {
  currentStep: ConsultationStep
  orientation?: 'horizontal' | 'vertical'
}

export function StepIndicator({ currentStep, orientation = 'horizontal' }: StepIndicatorProps) {
  const steps: ConsultationStep[] = [1, 2, 3, 4, 5]

  if (orientation === 'vertical') {
    return (
      <ol className="flex flex-col gap-1" aria-label="Progresso do atendimento">
        {steps.map((step, idx) => {
          const isCompleted = step < currentStep
          const isCurrent = step === currentStep
          return (
            <li key={step} className="flex flex-col">
              <div className="flex items-center gap-3">
                <div
                  aria-label={isCurrent ? `Passo atual: ${step}` : undefined}
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold shrink-0 transition-colors ${
                    isCompleted
                      ? 'bg-primary text-primary-foreground'
                      : isCurrent
                      ? 'border-2 border-primary text-primary'
                      : 'border-2 border-border text-muted-foreground'
                  }`}
                >
                  {isCompleted ? '✓' : step}
                </div>
                <span className={`text-sm ${isCurrent ? 'font-medium text-foreground' : isCompleted ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
                  {STEP_LABELS[step]}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div className={`ml-4 w-px h-5 ${isCompleted ? 'bg-primary' : 'bg-border'}`} />
              )}
            </li>
          )
        })}
      </ol>
    )
  }

  return (
    <ol className="flex items-center gap-2" aria-label="Progresso do atendimento">
      {steps.map((step, idx) => {
        const isCompleted = step < currentStep
        const isCurrent = step === currentStep
        return (
          <li key={step} className="flex items-center gap-2">
            <div
              aria-label={isCurrent ? `Passo atual: ${step}` : undefined}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                isCompleted
                  ? 'bg-primary text-primary-foreground'
                  : isCurrent
                  ? 'border-2 border-primary text-primary'
                  : 'border-2 border-border text-muted-foreground'
              }`}
            >
              {isCompleted ? '✓' : step}
            </div>
            <span className={`hidden text-xs sm:block ${isCurrent ? 'font-medium text-primary' : 'text-muted-foreground'}`}>
              {STEP_LABELS[step]}
            </span>
            {idx < steps.length - 1 && (
              <div className={`h-px w-6 ${isCompleted ? 'bg-primary' : 'bg-border'}`} />
            )}
          </li>
        )
      })}
    </ol>
  )
}
