'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { API } from '@/lib/routes'
import { AppAlertDialog } from '@/components/ui/app-alert-dialog'
import type { UserRow } from './users-client'

export interface DeleteSummary { patients: number; consultations: number }

interface DeleteUserModalProps {
  user: UserRow | null
  summary: DeleteSummary | null
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function DeleteUserModal({ user, summary, open, onClose, onSuccess }: DeleteUserModalProps) {
  const [loading, setLoading] = useState(false)

  if (!user || !summary) return null

  const hasData = summary.patients > 0 || summary.consultations > 0

  async function handleDelete() {
    setLoading(true)
    const promise = fetch(API.adminUserId(user!.id), { method: 'DELETE' }).then(async (res) => {
      if (!res.ok) throw new Error('Erro ao excluir')
      onSuccess()
    })
    toast.promise(promise, { loading: 'Aguarde...', success: 'Usuário excluído!', error: (e: Error) => e.message })
    await promise.catch(() => {}).finally(() => setLoading(false))
  }

  return (
    <AppAlertDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={`Excluir ${user.name}?`}
      logoId="delete-user-modal"
      maxWidth="max-w-sm"
      description={
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Tem certeza que deseja excluir <strong className="text-foreground">{user.name}</strong>? Esta ação não pode ser desfeita.
          </p>
          {hasData && (
            <div className="rounded-xl p-3 space-y-2 bg-red-500/[0.06] border border-red-500/20">
              <p className="text-xs font-medium text-red-600 dark:text-red-400">Este usuário possui dados vinculados:</p>
              <ul className="space-y-1">
                {summary.patients > 0 && (
                  <li className="text-xs text-muted-foreground">
                    • <span className="text-foreground font-medium">{summary.patients}</span> paciente{summary.patients !== 1 ? 's' : ''}
                  </li>
                )}
                {summary.consultations > 0 && (
                  <li className="text-xs text-muted-foreground">
                    • <span className="text-foreground font-medium">{summary.consultations}</span> consulta{summary.consultations !== 1 ? 's' : ''}
                  </li>
                )}
              </ul>
              <p className="text-xs text-muted-foreground/70">Todos esses registros serão permanentemente removidos.</p>
            </div>
          )}
        </div>
      }
      cancelLabel="Cancelar"
      actionLabel={loading ? 'Aguarde...' : 'Excluir'}
      actionVariant="destructive"
      actionDisabled={loading}
      onConfirm={handleDelete}
    />
  )
}
