'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useEffect, useState } from 'react'
import { Stethoscope, User, Phone, Cpu } from 'lucide-react'
import { toast } from 'sonner'
import { API } from '@/lib/routes'
import { AppDialog } from '@/components/ui/app-dialog'
import type { UserRow } from './users-client'
import type { CostResult } from '@/server/repositories/usage'
import { formatBRL } from '@/lib/currency'

const editSchema = z.object({
  name: z.string().min(2, 'Nome muito curto'),
  specialty: z.string().optional(),
  phone: z.string().optional(),
})
type EditFormData = z.infer<typeof editSchema>

const ENDPOINT_LABELS: Record<string, string> = {
  transcription: 'Transcrição',
  anamnesis:     'Anamnese',
  refine:        'Refinamentos',
}

interface EditUserModalProps {
  user: UserRow | null
  open: boolean
  onClose: () => void
  onSuccess: (user: UserRow) => void
  usdToBrl?: number
}

export function EditUserModal({ user, open, onClose, onSuccess, usdToBrl = 5.75 }: EditUserModalProps) {
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    mode: 'onTouched',
    defaultValues: { name: user?.name ?? '', specialty: user?.specialty ?? '', phone: user?.phone ?? '' },
  })

  const [costResult, setCostResult] = useState<CostResult | null>(null)

  useEffect(() => {
    if (!open || !user) { setCostResult(null); return }
    fetch(API.adminUserGroqCost(user.id))
      .then((r) => r.json())
      .then((data: CostResult) => setCostResult(data))
      .catch(() => {})
  }, [open, user])

  useEffect(() => {
    if (user) reset({ name: user.name, specialty: user.specialty ?? '', phone: user.phone ?? '' })
  }, [user, reset])

  if (!user) return null

  async function onSubmit(data: EditFormData) {
    const promise = fetch(API.adminUserId(user!.id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(async (res) => {
      if (!res.ok) throw new Error('Erro ao salvar')
      onSuccess({ ...user!, ...data })
    })
    toast.promise(promise, { loading: 'Aguarde...', success: 'Usuário atualizado!', error: (e: Error) => e.message })
    await promise.catch(() => {})
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Editar usuário"
      description={`Atualize os dados de ${user.name}.`}
      logoId="edit-user-modal"
      formId="edit-user-form"
      submitLabel="Salvar alterações"
      submitDisabled={isSubmitting}
    >
      <form id="edit-user-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" /> Nome completo
          </label>
          <input
            {...register('name')}
            className="w-full bg-transparent border-b border-border pb-1.5 text-sm text-foreground focus:outline-none focus:border-highlight transition-colors"
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Stethoscope className="h-3.5 w-3.5" /> Especialidade
          </label>
          <input
            {...register('specialty')}
            className="w-full bg-transparent border-b border-border pb-1.5 text-sm text-foreground focus:outline-none focus:border-highlight transition-colors"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5" /> WhatsApp
          </label>
          <input
            {...register('phone')}
            className="w-full bg-transparent border-b border-border pb-1.5 text-sm text-foreground focus:outline-none focus:border-highlight transition-colors"
          />
        </div>
      </form>

      {/* Consumo Groq — separado do form para não submeter */}
      <div className="border-t border-border pt-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /> Consumo Groq
        </p>
        {!costResult ? (
          <p className="text-xs text-muted-foreground">Carregando...</p>
        ) : costResult.breakdown.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem uso registrado.</p>
        ) : (
          <div className="space-y-1">
            {costResult.breakdown.map((b) => (
              <div key={b.endpoint} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {ENDPOINT_LABELS[b.endpoint] ?? b.endpoint}
                  <span className="ml-1 text-muted-foreground/60">×{b.callCount}</span>
                </span>
                <div className="text-right">
                  <span className="font-mono text-foreground">${b.totalCost.toFixed(4)}</span>
                  <p className="font-mono text-muted-foreground/70 text-[10px]">{formatBRL(b.totalCost, usdToBrl)}</p>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
              <span className="font-medium text-foreground">Total</span>
              <div className="text-right">
                <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">${costResult.total.toFixed(4)}</span>
                <p className="font-mono text-muted-foreground text-[10px]">{formatBRL(costResult.total, usdToBrl)}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppDialog>
  )
}
