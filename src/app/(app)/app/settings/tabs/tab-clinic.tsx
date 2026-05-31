'use client'

import { forwardRef, useImperativeHandle, useState } from 'react'
import { useForm, Controller, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, MapPin, Info, Save, Loader2, Search } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FieldInput, FieldLabel } from '@/components/ui/field-input'
import { toast } from 'sonner'
import { clinicSchema, type ClinicFormData } from '@/lib/schemas'
import { formatCNPJ, formatCEP, formatPhone } from '@/lib/utils'
import type { StoredUser } from '@/server/repositories/users'
import { ClinicLogoUpload } from './clinic-logo-upload'

export interface ClinicHandle {
  validate: () => Promise<boolean>
  getValues: () => ClinicFormData
  /** true quando o logo foi enviado (valor atual não vazio) */
  hasLogo: () => boolean
}

interface Props {
  user: StoredUser
  isOnboarding?: boolean
}

export const TabClinic = forwardRef<ClinicHandle, Props>(function TabClinic({ user, isOnboarding }, ref) {
  const [logoUrl, setLogoUrl] = useState<string | null>(user.clinicLogoUrl ?? null)
  const [cepLoading, setCepLoading] = useState(false)

  const {
    register,
    control,
    watch,
    trigger,
    setValue,
    getValues,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ClinicFormData>({
    resolver: zodResolver(clinicSchema) as Resolver<ClinicFormData>,
    mode: 'onTouched',
    defaultValues: {
      clinicName: user.clinicName ?? '',
      clinicCnpj: user.clinicCnpj ? formatCNPJ(user.clinicCnpj) : '',
      clinicAddress: user.clinicAddress ?? '',
      clinicAddressNumber: user.clinicAddressNumber ?? '',
      clinicCep: user.clinicCep ? formatCEP(user.clinicCep) : '',
      clinicPhone: user.clinicPhone ? formatPhone(user.clinicPhone) : '',
      clinicEmail: user.clinicEmail ?? '',
      clinicWebsite: user.clinicWebsite ?? '',
      clinicRtIsSelf: user.clinicRtIsSelf ?? true,
      clinicRtName: user.clinicRtName ?? '',
      clinicRtRegistry: user.clinicRtRegistry ?? '',
      clinicBusinessHours: user.clinicBusinessHours ?? '',
    },
  })

  const rtIsSelf = watch('clinicRtIsSelf')

  async function handleCepBlur(value: string) {
    const digits = value.replace(/\D/g, '')
    if (digits.length !== 8) return
    setCepLoading(true)
    try {
      const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      if (!r.ok) return
      const data = (await r.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string }
      if (data.erro) {
        toast.error('CEP não encontrado.')
        return
      }
      const parts = [data.logradouro, data.bairro, data.localidade && data.uf ? `${data.localidade} - ${data.uf}` : '']
        .filter(Boolean)
        .join(', ')
      if (parts) setValue('clinicAddress', parts, { shouldValidate: true, shouldDirty: true })
    } catch {
      toast.error('Erro ao buscar CEP.')
    } finally {
      setCepLoading(false)
    }
  }

  useImperativeHandle(ref, () => ({
    validate: () => trigger(),
    getValues: () => getValues(),
    hasLogo: () => !!logoUrl,
  }))

  async function onSubmit(data: ClinicFormData) {
    const promise = fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => {
      if (!r.ok) throw new Error('Erro ao salvar')
    })
    toast.promise(promise, {
      loading: 'Aguarde...',
      success: 'Dados da clínica salvos.',
      error: 'Erro ao salvar.',
    })
    await promise.catch(() => {})
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Identificação */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex gap-4">
            <div className="shrink-0">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-violet-500/15 dark:bg-violet-500/10 border border-violet-500/25 dark:border-violet-500/20">
                <Building2 className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
            </div>
            <div className="flex-1 space-y-1 pt-1">
              <p className="text-sm font-semibold text-foreground uppercase tracking-wide">Identificação</p>
              <p className="text-xs text-muted-foreground">Dados que aparecem no cabeçalho dos documentos gerados.</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div className="space-y-1">
              <FieldLabel>Logo (opcional)</FieldLabel>
              <ClinicLogoUpload value={logoUrl} onChange={setLogoUrl} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <div className="space-y-1">
                <FieldLabel>Nome da clínica</FieldLabel>
                <FieldInput {...register('clinicName')} data-testid="settings-clinic-name" />
                {errors.clinicName && (
                  <p className="text-xs text-destructive">{errors.clinicName.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <FieldLabel>CNPJ</FieldLabel>
                <FieldInput
                  {...register('clinicCnpj')}
                  placeholder="00.000.000/0000-00"
                  inputMode="numeric"
                  maxLength={18}
                  onChange={(e) => setValue('clinicCnpj', formatCNPJ(e.target.value), { shouldValidate: true })}
                  data-testid="settings-clinic-cnpj"
                />
                {errors.clinicCnpj && (
                  <p className="text-xs text-destructive">{errors.clinicCnpj.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <FieldLabel>Telefone</FieldLabel>
                <FieldInput
                  {...register('clinicPhone')}
                  placeholder="(00) 00000-0000"
                  inputMode="tel"
                  maxLength={15}
                  onChange={(e) => setValue('clinicPhone', formatPhone(e.target.value), { shouldValidate: true })}
                />
                {errors.clinicPhone && (
                  <p className="text-xs text-destructive">{errors.clinicPhone.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <FieldLabel>E-mail</FieldLabel>
                <FieldInput
                  {...register('clinicEmail')}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="contato@suaclinica.com (pode ser igual ao seu)"
                />
                {errors.clinicEmail && (
                  <p className="text-xs text-destructive">{errors.clinicEmail.message}</p>
                )}
              </div>
              <div className="sm:col-span-2 space-y-1">
                <FieldLabel>Site (opcional)</FieldLabel>
                <FieldInput {...register('clinicWebsite')} type="url" inputMode="url" placeholder="https://" />
                {errors.clinicWebsite && (
                  <p className="text-xs text-destructive">{errors.clinicWebsite.message}</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Endereço */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex gap-4">
            <div className="shrink-0">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-cyan-500/15 dark:bg-cyan-500/10 border border-cyan-500/25 dark:border-cyan-500/20">
                <MapPin className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              </div>
            </div>
            <div className="flex-1 space-y-1 pt-1">
              <p className="text-sm font-semibold text-foreground uppercase tracking-wide">Endereço</p>
              <p className="text-xs text-muted-foreground">Exibido no rodapé dos documentos.</p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            <div className="max-w-[340px] space-y-1">
              <FieldLabel>CEP</FieldLabel>
              <div className="flex items-end gap-2">
                <div className="relative flex-1">
                  <FieldInput
                    {...register('clinicCep')}
                    placeholder="00000-000"
                    inputMode="numeric"
                    maxLength={9}
                    onChange={(e) => setValue('clinicCep', formatCEP(e.target.value), { shouldValidate: true })}
                    onBlur={(e) => handleCepBlur(e.target.value)}
                  />
                  {cepLoading && (
                    <Loader2 className="absolute right-0 top-2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  disabled={cepLoading}
                  onClick={() => handleCepBlur(getValues('clinicCep'))}
                >
                  <Search className="h-3.5 w-3.5" />
                  Buscar
                </Button>
              </div>
              {errors.clinicCep && (
                <p className="text-xs text-destructive">{errors.clinicCep.message}</p>
              )}
              <p className="text-xs text-muted-foreground">Preenche o endereço automaticamente.</p>
            </div>
            <div className="space-y-1">
              <FieldLabel>Endereço</FieldLabel>
              <FieldInput {...register('clinicAddress')} placeholder="Preenchido automaticamente pelo CEP" />
              {errors.clinicAddress && (
                <p className="text-xs text-destructive">{errors.clinicAddress.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <FieldLabel>Número / complemento (opcional)</FieldLabel>
              <FieldInput {...register('clinicAddressNumber')} placeholder="100, Sala 5" />
              {errors.clinicAddressNumber && (
                <p className="text-xs text-destructive">{errors.clinicAddressNumber.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Informações adicionais */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex gap-4">
            <div className="shrink-0">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-violet-500/15 dark:bg-violet-500/10 border border-violet-500/25 dark:border-violet-500/20">
                <Info className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
            </div>
            <div className="flex-1 space-y-1 pt-1">
              <p className="text-sm font-semibold text-foreground uppercase tracking-wide">Informações adicionais</p>
              <p className="text-xs text-muted-foreground">Responsável técnico e horário de atendimento.</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <Controller
              control={control}
              name="clinicRtIsSelf"
              render={({ field }) => (
                <label
                  htmlFor="clinicRtIsSelf"
                  className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none"
                >
                  <input
                    id="clinicRtIsSelf"
                    type="checkbox"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    className="h-4 w-4 accent-violet-500"
                  />
                  Sou o Responsável Técnico desta clínica
                </label>
              )}
            />

            {!rtIsSelf && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <div className="space-y-1">
                  <FieldLabel htmlFor="clinicRtName">Nome do Responsável Técnico</FieldLabel>
                  <FieldInput id="clinicRtName" {...register('clinicRtName')} />
                  {errors.clinicRtName && (
                    <p className="text-xs text-destructive">{errors.clinicRtName.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <FieldLabel>Registro do RT</FieldLabel>
                  <FieldInput {...register('clinicRtRegistry')} placeholder="Ex: CRM/SP 123456" />
                  {errors.clinicRtRegistry && (
                    <p className="text-xs text-destructive">{errors.clinicRtRegistry.message}</p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <FieldLabel>Horário de atendimento (opcional)</FieldLabel>
              <FieldInput {...register('clinicBusinessHours')} placeholder="Ex: Seg a Sex, 8h-18h" />
            </div>
          </div>
        </CardContent>
      </Card>

      {!isOnboarding && (
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting} className="gap-2">
            {!isSubmitting && <Save className="h-3.5 w-3.5" />}
            {isSubmitting ? 'Aguarde...' : 'Salvar alterações'}
          </Button>
        </div>
      )}
    </form>
  )
})
