'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Save, UserCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { IconBadge } from '@/components/ui/icon-badge'
import { FieldInput, FieldLabel } from '@/components/ui/field-input'
import { updateMasterProfile } from '@/server/actions/settings'
import { masterProfileSchema, type MasterProfileFormData } from '@/lib/schemas'

interface TabProfileProps {
  userName: string
  userEmail: string
  userPhone: string
}

export function TabProfile({ userName, userEmail, userPhone }: TabProfileProps) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<MasterProfileFormData>({
    resolver: zodResolver(masterProfileSchema),
    mode: 'onTouched',
    defaultValues: { name: userName, phone: userPhone },
  })

  async function onSubmit(data: MasterProfileFormData) {
    const promise = updateMasterProfile({ name: data.name, phone: data.phone }).then((r) => {
      if (!r.ok) throw new Error(r.error)
    })
    toast.promise(promise, {
      loading: 'Aguarde...',
      success: 'Perfil atualizado.',
      error: (e: Error) => e.message,
    })
    await promise.catch(() => {})
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex gap-4">
            <div className="shrink-0">
              <IconBadge icon={UserCircle} />
            </div>
            <div className="flex-1 space-y-1 pt-1">
              <p className="text-sm font-semibold text-foreground uppercase tracking-wide">Pessoais</p>
              <p className="text-xs text-muted-foreground">Informações de identificação básica da conta master.</p>
            </div>
          </div>

          <div className="mt-5 max-w-sm space-y-4">
            <div className="space-y-1">
              <FieldLabel>Nome</FieldLabel>
              <FieldInput {...register('name')} />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <FieldLabel>E-mail</FieldLabel>
              <FieldInput value={userEmail} disabled className="opacity-50 cursor-not-allowed" data-testid="console-profile-email" />
            </div>

            <div className="space-y-1">
              <FieldLabel>Telefone / WhatsApp</FieldLabel>
              <FieldInput
                {...register('phone')}
                placeholder="(00) 00000-0000"
                data-testid="console-profile-phone"
              />
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting} className="gap-2">
          {!isSubmitting && <Save className="h-3.5 w-3.5" />}
          {isSubmitting ? 'Aguarde...' : 'Salvar alterações'}
        </Button>
      </div>
    </form>
  )
}
