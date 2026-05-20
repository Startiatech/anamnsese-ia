'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Save } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FieldInput, FieldLabel } from '@/components/ui/field-input'
import { updateMasterProfile } from '@/server/actions/settings'

const schema = z.object({
  name: z.string().min(2, 'Nome muito curto').max(100),
})

type FormData = z.infer<typeof schema>

export function TabProfile({ userName }: { userName: string }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { name: userName },
  })

  async function onSubmit(data: FormData) {
    const promise = updateMasterProfile({ name: data.name }).then((r) => {
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
          <div className="max-w-sm space-y-4">
            <div className="space-y-1">
              <FieldLabel>Nome</FieldLabel>
              <FieldInput {...register('name')} />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
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
