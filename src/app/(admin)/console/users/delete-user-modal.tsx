'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { API } from '@/lib/routes'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Logo } from '@/components/ui/logo'
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
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <div className="flex flex-col items-center gap-4 mb-4">
            <Logo size="sm" id="delete-user-modal" />
            <div className="w-full h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
          </div>
          <AlertDialogTitle>Excluir {user.name}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
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
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? 'Aguarde...' : 'Excluir'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
