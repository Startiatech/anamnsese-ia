'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { UserPen } from 'lucide-react'
import { formatCPF, formatPhone } from '@/lib/utils'
import { patientSchema, type PatientFormData } from '@/lib/schemas'
import { API } from '@/lib/routes'
import { Input } from '@/components/ui/input'
import { FormLabel } from '@/components/ui/form-label'
import { AppSheet } from '@/components/ui/app-sheet'
import { BirthDateSelect } from '@/components/ui/birth-date-select'
import type { PatientWithStats } from '@/types'

interface EditPatientSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patient: PatientWithStats
  onSuccess: (updated: PatientWithStats) => void
}

const FORM_ID = 'edit-patient-form'

export function EditPatientSheet({ open, onOpenChange, patient, onSuccess }: EditPatientSheetProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    mode: 'onTouched',
  })

  useEffect(() => {
    if (open) {
      reset({
        name: patient.name,
        cpf: patient.cpf,
        birthDate: patient.birthDate ?? '',
        phone: patient.phone ?? '',
        externalId: patient.externalId ?? '',
      })
    }
  }, [open, patient, reset])

  const cpfValue = watch('cpf') ?? ''
  const phoneValue = watch('phone') ?? ''

  async function onSubmit(data: PatientFormData) {
    const promise = fetch(API.patientId(patient.id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(async (res) => {
      if (!res.ok) throw new Error('Erro ao atualizar paciente')
      return res.json()
    })

    toast.promise(promise, {
      loading: 'Aguarde...',
      success: 'Paciente atualizado!',
      error: 'Erro ao atualizar paciente.',
    })

    await promise.catch(() => null).then((result) => {
      if (!result) return
      onOpenChange(false)
      onSuccess({ ...patient, ...data })
    })
  }

  return (
    <AppSheet
      open={open}
      onOpenChange={onOpenChange}
      onCancel={() => reset()}
      title="Editar Paciente"
      description={`Altere os dados de ${patient.name}.`}
      icon={<UserPen className="h-4 w-4 text-violet-600 dark:text-violet-400" />}
      formId={FORM_ID}
      submitLabel="Salvar alterações"
      submitDisabled={isSubmitting}
    >
      <form id={FORM_ID} role="form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-1">
          <FormLabel htmlFor="ep-name" required>Nome completo</FormLabel>
          <Input id="ep-name" {...register('name')} autoFocus />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-1">
          <FormLabel htmlFor="ep-cpf" required>CPF</FormLabel>
          <Input
            id="ep-cpf"
            placeholder="000.000.000-00"
            maxLength={14}
            name="cpf"
            ref={register('cpf').ref}
            onBlur={register('cpf').onBlur}
            value={cpfValue}
            onChange={e => setValue('cpf', formatCPF(e.target.value), { shouldValidate: true })}
          />
          {errors.cpf && <p className="text-xs text-destructive">{errors.cpf.message}</p>}
        </div>

        <div className="space-y-1">
          <FormLabel required>Data de nascimento</FormLabel>
          <Controller
            name="birthDate"
            control={control}
            render={({ field }) => (
              <BirthDateSelect
                value={field.value ?? ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
          {errors.birthDate && <p className="text-xs text-destructive">{errors.birthDate.message}</p>}
        </div>

        <div className="space-y-1">
          <FormLabel htmlFor="ep-phone">Telefone</FormLabel>
          <Input
            id="ep-phone"
            placeholder="(00) 00000-0000"
            maxLength={15}
            name="phone"
            ref={register('phone').ref}
            onBlur={register('phone').onBlur}
            value={phoneValue}
            onChange={e => setValue('phone', formatPhone(e.target.value), { shouldValidate: true })}
          />
        </div>

        <div className="space-y-1">
          <FormLabel htmlFor="ep-externalId">Identificação / Prontuário</FormLabel>
          <Input
            id="ep-externalId"
            placeholder="Código ou número no sistema externo (opcional)"
            maxLength={100}
            {...register('externalId')}
          />
        </div>
      </form>
    </AppSheet>
  )
}
