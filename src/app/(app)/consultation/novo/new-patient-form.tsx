'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormLabel } from '@/components/ui/form-label'
import { Card, CardContent } from '@/components/ui/card'
import { usePatients } from '@/hooks/use-patients'
import { useApp } from '@/context/app-context'
import { formatCPF } from '@/lib/utils'
import { patientSchema, type PatientFormData } from '@/lib/schemas'
import { API, ROUTES } from '@/lib/routes'

const DEBIT_KEY = 'consultation_debit_pending'

export function NewPatientForm() {
  const router = useRouter()
  const { createPatient } = usePatients()
  const { credits, refreshCredits } = useApp()
  const refunded = useRef(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    mode: 'onTouched',
  })

  const cpfValue = watch('cpf') ?? ''

  useEffect(() => {
    return () => {
      if (refunded.current) return
      if (!sessionStorage.getItem(DEBIT_KEY)) return
      refunded.current = true
      sessionStorage.removeItem(DEBIT_KEY)
      fetch(API.meCredit, { method: 'POST' }).then(() => {
        refreshCredits()
        toast.info('Crédito estornado')
      })
    }
  }, [refreshCredits])

  async function onSubmit(data: PatientFormData) {
    if (credits <= 0) {
      toast.error('Créditos insuficientes. Adquira um plano para continuar.')
      return
    }
    const createPromise = createPatient({
      name: data.name,
      cpf: data.cpf,
      birthDate: data.birthDate || undefined,
      phone: data.phone || undefined,
    })
    toast.promise(createPromise, {
      loading: 'Aguarde...',
      success: 'Paciente cadastrado.',
      error: 'Erro ao cadastrar paciente — tente novamente.',
    })
    const patient = await createPromise.catch(() => null)
    if (!patient) return
    refunded.current = true
    sessionStorage.removeItem(DEBIT_KEY)
    router.push(ROUTES.atendimentoId(patient.id))
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={ROUTES.atendimento} className="text-sm text-primary hover:underline">← Voltar</Link>
        <h1 className="mt-2 text-2xl font-bold">Novo Paciente</h1>
      </div>

      <Card>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <FormLabel htmlFor="name" required>Nome completo</FormLabel>
              <Input id="name" {...register('name')} autoFocus />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1">
              <FormLabel htmlFor="cpf" required>CPF</FormLabel>
              <Input
                id="cpf"
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
              <FormLabel htmlFor="birthDate">Data de nascimento</FormLabel>
              <Input id="birthDate" type="date" {...register('birthDate')} />
            </div>

            <div className="space-y-1">
              <FormLabel htmlFor="phone">Telefone</FormLabel>
              <Input id="phone" placeholder="(00) 00000-0000" {...register('phone')} />
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Aguarde...' : 'Salvar e iniciar atendimento'}
              </Button>
              <Link href={ROUTES.atendimento}>
                <Button type="button" variant="ghost">Cancelar</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
