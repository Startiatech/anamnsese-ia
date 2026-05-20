'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Eye, EyeOff, Save } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FieldInput, FieldLabel } from '@/components/ui/field-input'
import { updateMasterProfile } from '@/server/actions/settings'

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual'),
    newPassword:     z.string().min(6, 'Mínimo 6 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  })

type FormData = z.infer<typeof schema>

function PasswordField({
  label,
  reg,
  error,
}: {
  label: string
  reg: ReturnType<ReturnType<typeof useForm<FormData>>['register']>
  error?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="space-y-1">
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <FieldInput
          {...reg}
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

export function TabSecurity({ userName }: { userName: string }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
  })

  async function onSubmit(data: FormData) {
    const promise = updateMasterProfile({
      name: userName,
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
      confirmPassword: data.confirmPassword,
    }).then((r) => {
      if (!r.ok) throw new Error(r.error)
      reset()
    })
    toast.promise(promise, {
      loading: 'Aguarde...',
      success: 'Senha atualizada.',
      error: (e: Error) => e.message,
    })
    await promise.catch(() => {})
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="max-w-sm space-y-4">
            <PasswordField
              label="Senha atual"
              reg={register('currentPassword')}
              error={errors.currentPassword?.message}
            />
            <PasswordField
              label="Nova senha"
              reg={register('newPassword')}
              error={errors.newPassword?.message}
            />
            <PasswordField
              label="Confirmar nova senha"
              reg={register('confirmPassword')}
              error={errors.confirmPassword?.message}
            />
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
