'use client'

import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'

interface OnboardingChecklistProps {
  passwordChanged: boolean
  profileCompleted: boolean
}

const STEPS = [
  { label: 'Alterar senha', description: 'Troque a senha provisória' },
  { label: 'Completar perfil', description: 'Especialidade e registro' },
]

export function OnboardingChecklist({ passwordChanged, profileCompleted }: OnboardingChecklistProps) {
  const router = useRouter()
  const done = [passwordChanged, profileCompleted]
  const completedCount = done.filter(Boolean).length
  const progress = (completedCount / STEPS.length) * 100
  const allDone = completedCount === STEPS.length

  return (
    <div className="rounded-xl overflow-hidden border border-primary/20 dark:border-primary/15 bg-primary/[0.06] dark:bg-primary/[0.04]">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Configuração inicial</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {allDone ? 'Tudo pronto! Acesse a plataforma.' : `${completedCount} de ${STEPS.length} etapas concluídas`}
          </p>
        </div>
        {allDone && (
          <button
            onClick={() => router.push('/app/dashboard')}
            className="shrink-0 flex items-center gap-1.5 h-8 px-4 rounded-lg text-xs font-medium text-white transition-all shadow-[0_0_20px_var(--glow-brand)]"
            style={{ background: 'var(--gradient-brand)' }}
          >
            Acessar plataforma
            <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-px mx-5 bg-black/10 dark:bg-white/8">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${progress}%`, background: 'var(--gradient-brand)' }}
        />
      </div>

    </div>
  )
}
