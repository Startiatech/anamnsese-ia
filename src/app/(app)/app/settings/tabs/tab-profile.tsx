'use client'

import { forwardRef, useImperativeHandle, useState, useRef, useEffect } from 'react'
import { useForm, Controller, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { UserCircle, Stethoscope, Save, ChevronDown, Timer } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { IconBadge } from '@/components/ui/icon-badge'
import { FieldInput, FieldLabel } from '@/components/ui/field-input'
import { profileSchema, REGISTRY_TYPES, type ProfileFormData } from '@/lib/schemas'
import type { StoredUser } from '@/server/repositories/users'

export type { ProfileFormData }

const UF_LIST = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA',
  'MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN',
  'RO','RR','RS','SC','SE','SP','TO',
]

export interface ProfileHandle {
  /** Valida o formulário e exibe os erros. Retorna true se válido. */
  validate: () => Promise<boolean>
  /** Retorna os valores atuais do formulário. */
  getValues: () => ProfileFormData
}

function CrmTypeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between border-0 border-b border-border text-sm py-2 focus:outline-none focus:border-violet-500/60 focus-visible:ring-1 focus-visible:ring-violet-500/40 focus-visible:rounded-sm transition-colors bg-transparent text-foreground"
      >
        <span>{value}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 left-0 bottom-full mb-1 w-full rounded-lg overflow-hidden bg-popover border border-border shadow-lg">
          <div className="max-h-52 overflow-y-auto">
            {REGISTRY_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => { onChange(type); setOpen(false) }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-accent ${
                  value === type ? 'bg-primary/10 text-primary' : 'text-foreground'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function UfSelect({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between border-0 border-b border-border text-sm py-2 focus:outline-none focus:border-violet-500/60 focus-visible:ring-1 focus-visible:ring-violet-500/40 focus-visible:rounded-sm transition-colors"
        style={{ background: 'transparent', color: value ? 'var(--foreground)' : 'var(--muted-foreground)' }}
      >
        <span>{value || '—'}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 left-0 bottom-full mb-1 w-full rounded-lg overflow-hidden bg-popover border border-border shadow-lg">
          <div className="max-h-40 overflow-y-auto">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors"
            >
              —
            </button>
            {UF_LIST.map((uf) => (
              <button
                key={uf}
                type="button"
                onClick={() => { onChange(uf); setOpen(false) }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-accent ${
                  value === uf ? 'bg-primary/10 text-primary' : 'text-foreground'
                }`}
              >
                {uf}
              </button>
            ))}
          </div>
        </div>
      )}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  )
}

interface TabProfileProps {
  user: StoredUser
  isOnboarding?: boolean
}

export const TabProfile = forwardRef<ProfileHandle, TabProfileProps>(function TabProfile(
  { user, isOnboarding },
  ref,
) {
  const { register, trigger, getValues, control, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema) as Resolver<ProfileFormData>,
    mode: 'onTouched',
    defaultValues: {
      name:                   user.name,
      phone:                  user.phone ?? '',
      specialty:              user.specialty ?? '',
      crmType:                (REGISTRY_TYPES.includes(user.crmType as typeof REGISTRY_TYPES[number]) ? user.crmType : 'Outros') as typeof REGISTRY_TYPES[number] ?? 'CRM',
      crmTypeCustom:          REGISTRY_TYPES.includes(user.crmType as typeof REGISTRY_TYPES[number]) ? '' : (user.crmType ?? ''),
      crmNumber:              user.crmNumber ?? '',
      crmUf:                  user.crmUf ?? '',
      minutesPerConsultation: user.minutesPerConsultation ?? 45,
    },
  })

  const watchedCrmType = watch('crmType')

  useImperativeHandle(ref, () => ({
    validate: () => trigger(),
    getValues: () => getValues(),
  }))

  // Submit próprio — apenas fora do onboarding
  async function onSubmit(data: ProfileFormData) {
    const resolvedCrmType = data.crmType === 'Outros' ? (data.crmTypeCustom ?? 'Outros') : data.crmType
    const { crmTypeCustom: _, ...rest } = data
    const promise = fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...rest, crmType: resolvedCrmType }),
    }).then(async (res) => {
      if (!res.ok) throw new Error('Erro ao salvar')
    })

    toast.promise(promise, {
      loading: 'Aguarde...',
      success: 'Perfil atualizado!',
      error: 'Erro ao salvar alterações.',
    })

    await promise.catch(() => {})
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Pessoais */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex gap-4">
            <div className="shrink-0">
              <IconBadge icon={UserCircle} />
            </div>
            <div className="flex-1 space-y-1 pt-1">
              <p className="text-sm font-semibold text-foreground uppercase tracking-wide">Pessoais</p>
              <p className="text-xs text-muted-foreground">Informações de identificação básica do profissional.</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <div className="sm:col-span-2 space-y-1">
              <FieldLabel>Nome completo</FieldLabel>
              <FieldInput {...register('name')} data-testid="settings-profile-name" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <FieldLabel>E-mail</FieldLabel>
              <FieldInput value={user.email} disabled className="opacity-50 cursor-not-allowed" />
            </div>
            <div className="space-y-1">
              <FieldLabel>Telefone</FieldLabel>
              <FieldInput {...register('phone')} placeholder="(00) 00000-0000" data-testid="settings-profile-phone" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CRM/CRP */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex gap-4">
            <div className="shrink-0">
              <IconBadge icon={Stethoscope} />
            </div>
            <div className="flex-1 space-y-1 pt-1">
              <p className="text-sm font-semibold text-foreground uppercase tracking-wide">Dados CRM/CRP</p>
              <p className="text-xs text-muted-foreground">Esses dados são usados para personalizar seus documentos médicos e faturamento.</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4">
            <div className="sm:col-span-3 space-y-1">
              <FieldLabel>Especialidade principal</FieldLabel>
              <FieldInput {...register('specialty')} />
              {errors.specialty && <p className="text-xs text-destructive">{errors.specialty.message}</p>}
            </div>
            <div className="space-y-1">
              <FieldLabel>Tipo</FieldLabel>
              <Controller
                control={control}
                name="crmType"
                render={({ field }) => (
                  <CrmTypeSelect value={field.value} onChange={field.onChange} />
                )}
              />
            </div>
            {watchedCrmType === 'Outros' && (
              <div className="space-y-1">
                <FieldLabel>Qual registro?</FieldLabel>
                <FieldInput
                  {...register('crmTypeCustom')}
                  placeholder="Ex: CRESS, CFO..."
                />
                {errors.crmTypeCustom && <p className="text-xs text-destructive">{errors.crmTypeCustom.message}</p>}
              </div>
            )}
            <div className="space-y-1">
              <FieldLabel>Número</FieldLabel>
              <FieldInput {...register('crmNumber')} />
              {errors.crmNumber && <p className="text-xs text-destructive">{errors.crmNumber.message}</p>}
            </div>
            <div className="space-y-1">
              <FieldLabel>UF</FieldLabel>
              <Controller
                control={control}
                name="crmUf"
                render={({ field }) => (
                  <UfSelect value={field.value} onChange={field.onChange} error={errors.crmUf?.message} />
                )}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tempo por consulta */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex gap-4">
            <div className="shrink-0">
              <IconBadge icon={Timer} />
            </div>
            <div className="flex-1 space-y-1 pt-1">
              <p className="text-sm font-semibold text-foreground uppercase tracking-wide">Tempo médio por consulta</p>
              <p className="text-xs text-muted-foreground">Usado para calcular o tempo poupado no painel. Ajuste conforme sua rotina.</p>
            </div>
          </div>
          <div className="mt-5 max-w-xs space-y-1">
            <FieldLabel>Minutos por consulta</FieldLabel>
            <div className="flex items-center gap-2">
              <FieldInput
                type="number"
                min={5}
                max={240}
                {...register('minutesPerConsultation')}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">min</span>
            </div>
            {errors.minutesPerConsultation && (
              <p className="text-xs text-destructive">{errors.minutesPerConsultation.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Botão próprio — apenas fora do onboarding */}
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
