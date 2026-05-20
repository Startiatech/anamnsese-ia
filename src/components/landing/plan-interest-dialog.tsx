'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AppDialog } from '@/components/ui/app-dialog'
import { planInterestSchema, type PlanInterestFormData, type PlanInterestPlan } from '@/lib/schemas'
import { savePlanInterestAction } from '@/server/actions/plan-interest'

const PLAN_LABELS: Record<PlanInterestPlan, string> = {
  profissional:      'Profissional',
  'gestao-clinicas': 'Gestão & Clínicas',
}

const FORM_ID = 'plan-interest-form'

interface PlanInterestDialogProps {
  plan: PlanInterestPlan
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PlanInterestDialog({ plan, open, onOpenChange }: PlanInterestDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PlanInterestFormData>({
    mode: 'onTouched',
    resolver: zodResolver(planInterestSchema),
    defaultValues: { plan },
  })

  async function onSubmit(data: PlanInterestFormData) {
    await toast.promise(
      savePlanInterestAction(data).then((res) => {
        if (res.error) throw new Error(res.error)
        onOpenChange(false)
        reset()
      }).catch((err: unknown) => { throw err }),
      {
        loading: 'Aguarde...',
        success: 'Interesse registrado! Você será notificado quando o plano estiver disponível.',
        error: 'Erro ao registrar interesse — tente novamente.',
      }
    )
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Quero ser avisado — ${PLAN_LABELS[plan]}`}
      description="Deixe seus dados e te avisamos assim que o plano estiver disponível."
      logoId="plan-interest-dialog"
      formId={FORM_ID}
      submitLabel="Quero ser avisado"
      submitDisabled={isSubmitting}
      cancelLabel="Cancelar"
    >
      <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <input type="hidden" {...register('plan')} />

        <div className="space-y-1.5">
          <Label htmlFor="interest-name">Nome</Label>
          <Input
            id="interest-name"
            placeholder="Seu nome completo"
            autoComplete="name"
            {...register('name')}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="interest-email">Email</Label>
          <Input
            id="interest-email"
            type="email"
            placeholder="seu@email.com"
            autoComplete="email"
            {...register('email')}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>
      </form>
    </AppDialog>
  )
}
