// src/components/steps/StepResponsibility.tsx
'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useConsultationFlow } from '@/context/consultation-context'
import { responsibilitySchema, type ResponsibilityFormData } from '@/lib/schemas'
import { saveRecordingConsent } from '@/server/actions/consultation'

const CONSENT_TEXT = 'Confirmo que orientei o paciente sobre a gravação da consulta e que ele autorizou o uso deste sistema.'

interface StepResponsibilityProps {
  patientId: string
}

export function StepResponsibility({ patientId }: StepResponsibilityProps) {
  const { nextStep } = useConsultationFlow()

  const {
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResponsibilityFormData>({
    resolver: zodResolver(responsibilitySchema),
    defaultValues: { confirmed: undefined },
  })

  const confirmed = watch('confirmed')

  async function onSubmit() {
    const savePromise = saveRecordingConsent(patientId, CONSENT_TEXT)
    toast.promise(savePromise, {
      loading: 'Aguarde...',
      success: 'Autorização salva.',
      error: 'Erro ao salvar — tente novamente.',
    })
    const ok = await savePromise.then(() => true).catch(() => false)
    if (ok) nextStep()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="flex flex-col md:flex-row md:gap-8 md:items-start">
        {/* Coluna principal */}
        <div className="flex-1 min-w-0 space-y-6">
          <div>
            <h2 className="text-lg font-semibold">Autorização de Gravação</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Confirme o consentimento do paciente antes de continuar.</p>
          </div>

          <Card>
            <CardContent className="pt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Este sistema processará a gravação de áudio da consulta utilizando inteligência artificial
                para transcrição e estruturação da anamnese.
              </p>
              <p className="text-sm text-muted-foreground">Ao continuar, você declara que:</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 pl-2">
                <li>O paciente foi informado sobre a gravação da consulta;</li>
                <li>O paciente autorizou expressamente o uso deste sistema;</li>
                <li>Você assume a responsabilidade pelo cumprimento das normas de privacidade e sigilo médico.</li>
              </ul>
            </CardContent>
          </Card>

          <div className="space-y-1">
            <div className="flex items-start gap-3">
              <Checkbox
                id="confirmed"
                checked={confirmed === true}
                onCheckedChange={val =>
                  setValue('confirmed', val === true ? true : (undefined as unknown as true), { shouldValidate: true })
                }
              />
              <Label htmlFor="confirmed" className="cursor-pointer text-sm leading-relaxed">
                {CONSENT_TEXT}
              </Label>
            </div>
            {errors.confirmed && (
              <p className="text-xs text-destructive">{errors.confirmed.message}</p>
            )}
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">Continuar</Button>
        </div>

        {/* Painel contextual */}
        <div className="w-full md:w-72 shrink-0 space-y-4 mt-6 md:mt-0 md:sticky md:top-4">
          <div className="rounded-xl border border-primary/15 p-5 space-y-4 bg-primary/[0.04]">
            <p className="text-xs font-bold uppercase tracking-widest text-highlight">Por que isso importa</p>
            <ul className="space-y-3">
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                A LGPD exige consentimento explícito para coleta e processamento de dados de saúde.
              </li>
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                O sigilo médico se aplica a todo conteúdo gerado nesta sessão.
              </li>
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                A transcrição e a anamnese ficam vinculadas exclusivamente ao seu perfil profissional.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </form>
  )
}
