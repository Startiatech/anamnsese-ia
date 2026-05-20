'use client'

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { UserPlus } from 'lucide-react'
import { formatCPF, formatPhone, generateId } from '@/lib/utils'
import { patientSchema, type PatientFormData } from '@/lib/schemas'
import { API } from '@/lib/routes'
import { Input } from '@/components/ui/input'
import { FormLabel } from '@/components/ui/form-label'
import { AppSheet } from '@/components/ui/app-sheet'
import { BirthDateSelect } from '@/components/ui/birth-date-select'
import type { Patient } from '@/types'

interface NewPatientSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (patient: Patient) => void
}

const FORM_ID = 'new-patient-form'

export function NewPatientSheet({ open, onOpenChange, onSuccess }: NewPatientSheetProps) {
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

  const cpfValue = watch('cpf') ?? ''
  const phoneValue = watch('phone') ?? ''

  async function onSubmit(data: PatientFormData) {
    const promise = fetch(API.patients, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: generateId(),
        name: data.name,
        cpf: data.cpf,
        birthDate: data.birthDate,
        phone: data.phone || undefined,
        externalId: data.externalId || undefined,
        createdAt: new Date().toISOString(),
      }),
    }).then(async (res) => {
      if (!res.ok) throw new Error('Erro ao cadastrar paciente')
      return res.json() as Promise<Patient>
    })

    toast.promise(promise, {
      loading: 'Aguarde...',
      success: 'Paciente cadastrado com sucesso!',
      error: 'Erro ao cadastrar paciente. Tente novamente.',
    })

    const patient = await promise.catch(() => null)
    if (!patient) return

    reset()
    onOpenChange(false)
    onSuccess(patient)
  }

  return (
    <AppSheet
      open={open}
      onOpenChange={onOpenChange}
      onCancel={reset}
      title="Novo Paciente"
      description="Preencha os dados para cadastrar um novo paciente."
      icon={<UserPlus className="h-4 w-4 text-violet-600 dark:text-violet-400" />}
      formId={FORM_ID}
      submitLabel="Salvar paciente"
      submitDisabled={isSubmitting}
    >
      <form id={FORM_ID} role="form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-1">
          <FormLabel htmlFor="np-name" required>Nome completo</FormLabel>
          <Input id="np-name" {...register('name')} autoFocus />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-1">
          <FormLabel htmlFor="np-cpf" required>CPF</FormLabel>
          <Input
            id="np-cpf"
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
          <FormLabel htmlFor="np-phone">Telefone</FormLabel>
          <Input
            id="np-phone"
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
          <FormLabel htmlFor="np-externalId">Identificação / Prontuário</FormLabel>
          <Input
            id="np-externalId"
            placeholder="Código ou número no sistema externo (opcional)"
            maxLength={100}
            {...register('externalId')}
          />
        </div>
      </form>
    </AppSheet>
  )
}
