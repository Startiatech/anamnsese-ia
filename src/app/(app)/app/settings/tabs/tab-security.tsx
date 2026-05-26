'use client'

import { forwardRef, useImperativeHandle, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { KeyRound, ShieldCheck, Eye, EyeOff, Trash2, CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FieldInput, FieldLabel } from '@/components/ui/field-input'
import { cancelAccountDeletion } from '@/server/actions/feedback'
import { DeleteAccountModal } from '../delete-account-modal'
import { setPinSchema, SetPinFormData } from '@/lib/schemas'
import { API } from '@/lib/routes'

const schema = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual'),
  newPassword:     z.string().min(8, 'Mínimo 8 caracteres'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
})

// No reset de senha, não exige senha atual (usuário não sabe a senha)
const schemaReset = z.object({
  currentPassword: z.string().optional(),
  newPassword:     z.string().min(8, 'Mínimo 8 caracteres'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
})

export type SecurityFormData = z.infer<typeof schema>

export interface SecurityHandle {
  validate: () => Promise<boolean>
  getValues: () => SecurityFormData
  pinSaved: boolean
}

function PasswordInput({ label, registration, error }: {
  label: string
  registration: ReturnType<ReturnType<typeof useForm<SecurityFormData>>['register']>
  error?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="space-y-1">
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <FieldInput
          {...registration}
          type={show ? 'text' : 'password'}
          className="pr-8"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setShow((v) => !v)}
          className="absolute right-0 top-1/2 -translate-y-1/2 h-6 w-6"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

interface TabSecurityProps {
  userId: string
  isOnboarding?: boolean
  isPasswordReset?: boolean
  isPinReset?: boolean
  deletionScheduledAt?: string | null
  hasPin?: boolean
}

export const TabSecurity = forwardRef<SecurityHandle, TabSecurityProps>(function TabSecurity(
  { isOnboarding, isPasswordReset = false, isPinReset = false, deletionScheduledAt, hasPin: initialHasPin = false },
  ref,
) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [hasPin, setHasPin] = useState(initialHasPin)
  const [pinSaved, setPinSaved] = useState(false)
  const isDeletionScheduled = !!deletionScheduledAt

  const {
    register: registerPin,
    handleSubmit: handlePinSubmit,
    formState: { errors: pinErrors, isSubmitting: pinSubmitting },
    reset: resetPin,
  } = useForm<SetPinFormData>({
    resolver: zodResolver(setPinSchema),
    mode: 'onTouched',
  })

  async function onPinSubmit(data: SetPinFormData) {
    const promise = fetch(API.mePin, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Erro ao salvar PIN')
      }
      setHasPin(true)
      setPinSaved(true)
      resetPin()
      router.refresh()
    })
    toast.promise(promise, {
      loading: 'Aguarde...',
      success: 'PIN salvo com sucesso!',
      error: (e: Error) => e.message,
    })
    await promise.catch(() => {})
  }

  async function handleCancelDeletion() {
    setCancelling(true)
    const promise = cancelAccountDeletion().then((r) => {
      if (r.error) throw new Error(r.error)
      window.location.reload()
    })
    toast.promise(promise, {
      loading: 'Aguarde...',
      success: 'Exclusão cancelada com sucesso.',
      error: 'Erro ao cancelar exclusão.',
    })
    await promise.catch(() => {})
    setCancelling(false)
  }
  const { register, trigger, getValues, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<SecurityFormData>({
    resolver: zodResolver(isPasswordReset ? schemaReset : schema) as Resolver<SecurityFormData>,
    mode: 'onTouched',
  })

  useImperativeHandle(ref, () => ({
    validate: () => trigger(),
    getValues: () => getValues(),
    pinSaved,
  }))

  // Submit próprio — apenas fora do onboarding
  async function onSubmit(data: SecurityFormData) {
    const promise = fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: data.currentPassword, newPassword: data.newPassword }),
    }).then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Erro ao atualizar senha')
      }
      reset()
    })

    toast.promise(promise, {
      loading: 'Aguarde...',
      success: 'Senha atualizada com sucesso!',
      error: (e) => e.message,
    })

    await promise.catch(() => {})
  }

  return (
    <div className="space-y-4">
      {/* Senha */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex gap-4 mb-5">
            <div className="shrink-0">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-violet-500/15 dark:bg-violet-500/10 border border-violet-500/25 dark:border-violet-500/20">
                <KeyRound className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
            </div>
            <div className="flex-1 space-y-1 pt-1">
              <p className="text-sm font-semibold text-foreground uppercase tracking-wide">Senha</p>
              <p className="text-xs text-muted-foreground">Recomendamos o uso de uma senha forte com pelo menos 8 caracteres, números e símbolos.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {!isPasswordReset && (
              <PasswordInput label="Senha atual" registration={register('currentPassword')} error={errors.currentPassword?.message} />
            )}
            <PasswordInput label="Nova senha"            registration={register('newPassword')}     error={errors.newPassword?.message} />
            <PasswordInput label="Confirmar nova senha"  registration={register('confirmPassword')} error={errors.confirmPassword?.message} />

            {/* Botão próprio — apenas fora do onboarding */}
            {!isOnboarding && (
              <div className="flex justify-end pt-1">
                <Button type="submit" disabled={isSubmitting || pinSubmitting}>
                  {isSubmitting ? 'Aguarde...' : 'Atualizar senha'}
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* PIN */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex gap-4 mb-5">
            <div className="shrink-0">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-500/15 dark:bg-emerald-500/10 border border-emerald-500/25 dark:border-emerald-500/20">
                <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <div className="flex-1 space-y-1 pt-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground uppercase tracking-wide">PIN de Recuperação</p>
                {hasPin && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Cadastrado
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {isPinReset
                  ? 'Seu PIN foi redefinido pelo suporte. Cadastre um novo PIN para continuar.'
                  : hasPin
                    ? 'Seu PIN está ativo. Use-o para recuperar o acesso caso esqueça sua senha.'
                    : 'Cadastre um PIN de 6 dígitos para poder recuperar sua senha caso a esqueça.'}
              </p>
            </div>
          </div>

          <form onSubmit={handlePinSubmit(onPinSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <FieldLabel>{hasPin ? 'Novo PIN' : 'PIN (6 dígitos)'}</FieldLabel>
                <FieldInput
                  {...registerPin('pin')}
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="••••••"
                  autoFocus={isPinReset}
                  className="tracking-[0.4em]"
                />
                {pinErrors.pin && <p className="text-xs text-destructive">{pinErrors.pin.message}</p>}
              </div>
              <div className="space-y-1">
                <FieldLabel>Confirmar PIN</FieldLabel>
                <FieldInput
                  {...registerPin('confirmPin')}
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="••••••"
                  className="tracking-[0.4em]"
                />
                {pinErrors.confirmPin && <p className="text-xs text-destructive">{pinErrors.confirmPin.message}</p>}
              </div>
            </div>

            {pinSaved && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                PIN atualizado com sucesso.
              </p>
            )}

            <div className="flex justify-end pt-1">
              <Button type="submit" disabled={pinSubmitting || isSubmitting} variant="outline" size="sm">
                {pinSubmitting ? 'Aguarde...' : hasPin ? 'Alterar PIN' : 'Cadastrar PIN'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Zona de perigo */}
      {!isOnboarding && (
        <Card className="border-red-500/30 dark:border-red-500/25">
          <CardContent className="pt-5 pb-5">
            <div className="flex gap-4 mb-5">
              <div className="shrink-0">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/15 dark:bg-red-500/10 border border-red-500/25 dark:border-red-500/20">
                  <Trash2 className="h-5 w-5 text-destructive" />
                </div>
              </div>
              <div className="flex-1 space-y-1 pt-1">
                <p className="text-sm font-semibold text-destructive uppercase tracking-wide">Zona de Perigo</p>
                <p className="text-xs text-muted-foreground">Ações irreversíveis relacionadas à sua conta.</p>
              </div>
            </div>

            {isDeletionScheduled ? (
              <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-red-500/10 dark:bg-red-500/[0.07] border border-red-500/25 dark:border-red-500/20">
                <div>
                  <p className="text-sm font-medium text-destructive">Exclusão agendada</p>
                  <p className="text-xs text-muted-foreground">
                    Seus dados serão removidos em {Math.ceil((new Date(deletionScheduledAt!).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} dias.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleCancelDeletion} disabled={cancelling || pinSubmitting || isSubmitting}>
                  {cancelling ? 'Aguarde...' : 'Cancelar exclusão'}
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Excluir conta</p>
                  <p className="text-xs text-muted-foreground">Remove permanentemente todos os seus dados. Você terá 7 dias para cancelar.</p>
                </div>
                <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)} disabled={pinSubmitting || isSubmitting}>
                  Solicitar exclusão
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <DeleteAccountModal open={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </div>
  )
})
