'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { UserPlus, Stethoscope, Mail, User, Phone } from 'lucide-react'
import { createUserSchema, type CreateUserFormData } from '@/lib/schemas'
import { generateTempPassword } from '@/lib/temp-password'
import { toast } from 'sonner'
import { AppDialog } from '@/components/ui/app-dialog'
import type { UserRow } from './users-client'

interface AddUserModalProps {
  open: boolean
  onClose: () => void
  onSuccess: (user: UserRow) => void
}

export function AddUserModal({ open, onClose, onSuccess }: AddUserModalProps) {
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    mode: 'onTouched',
  })

  async function onSubmit(data: CreateUserFormData) {
    const tempPassword = generateTempPassword()
    const phone = data.phone.replace(/\D/g, '')
    window.open(`https://wa.me/${phone.startsWith('55') ? phone : `55${phone}`}?text=${encodeURIComponent([
      '✅ *Anamnese IA — Bem-vindo(a)!*', '',
      `Olá, ${data.name.split(' ')[0]}! Seu acesso à plataforma foi criado.`, '',
      'Abaixo estão suas credenciais de acesso:',
      `📧 *E-mail:* ${data.email}`,
      `🔒 *Senha provisória:* ${tempPassword}`, '',
      '*Para acessar a plataforma, siga os passos abaixo:*',
      `1️⃣ Acesse a página principal pelo link: 🔗 ${process.env.NEXT_PUBLIC_SITE_URL}`,
      '2️⃣ Clique no botão *Entrar* no canto superior direito da página',
      '3️⃣ Insira seu e-mail e senha provisória para realizar o login', '',
      'Por segurança, recomendamos que você altere sua senha no primeiro acesso.', '',
      'Qualquer dúvida, estamos à disposição. Bom trabalho! 🩺',
    ].join('\n'))}`, '_blank')
    const promise = fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, password: tempPassword }),
    }).then(async (res) => {
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Erro ao criar usuário')
      }
      onSuccess({
        id: crypto.randomUUID(),
        name: data.name,
        email: data.email,
        specialty: data.specialty,
        phone: data.phone,
        createdAt: new Date().toISOString(),
        blocked: false,
        credits: 0,
        status: 'onboarding',
        groqCost: 0,
        hasPin: false,
        pinIsTemp: false,
      })
      reset()
    })
    toast.promise(promise, { loading: 'Aguarde...', success: 'Usuário criado com sucesso!', error: (err: Error) => err.message })
    await promise.catch(() => {})
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      onCancel={() => { reset(); onClose() }}
      title="Novo usuário"
      description="A senha provisória será gerada e enviada via WhatsApp."
      logoId="add-user-modal"
      formId="add-user-form"
      submitLabel="Criar e enviar acesso"
      submitDisabled={isSubmitting}
    >
      <form id="add-user-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="add-user-name" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" /> Nome completo
          </label>
          <input
            id="add-user-name"
            {...register('name')}
            autoComplete="off"
            placeholder="Dr. João Silva"
            className="w-full bg-transparent border-b border-border pb-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-highlight focus-visible:ring-1 focus-visible:ring-ring focus-visible:rounded-sm transition-colors"
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-1">
          <label htmlFor="add-user-email" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" /> Email
          </label>
          <input
            id="add-user-email"
            {...register('email')}
            type="email"
            autoComplete="off"
            placeholder="joao@clinica.com"
            className="w-full bg-transparent border-b border-border pb-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-highlight focus-visible:ring-1 focus-visible:ring-ring focus-visible:rounded-sm transition-colors"
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-1">
          <label htmlFor="add-user-specialty" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Stethoscope className="h-3.5 w-3.5" /> Especialidade
          </label>
          <input
            id="add-user-specialty"
            {...register('specialty')}
            autoComplete="off"
            placeholder="Clínica Geral, Cardiologia..."
            className="w-full bg-transparent border-b border-border pb-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-highlight focus-visible:ring-1 focus-visible:ring-ring focus-visible:rounded-sm transition-colors"
          />
          {errors.specialty && <p className="text-xs text-destructive">{errors.specialty.message}</p>}
        </div>
        <div className="space-y-1">
          <label htmlFor="add-user-phone" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5" /> WhatsApp
          </label>
          <input
            id="add-user-phone"
            {...register('phone')}
            autoComplete="off"
            placeholder="(11) 99999-9999"
            className="w-full bg-transparent border-b border-border pb-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-highlight focus-visible:ring-1 focus-visible:ring-ring focus-visible:rounded-sm transition-colors"
          />
          {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
        </div>
      </form>
    </AppDialog>
  )
}
