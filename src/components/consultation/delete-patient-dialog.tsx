'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { API } from '@/lib/routes'
import { AppAlertDialog } from '@/components/ui/app-alert-dialog'
import type { PatientWithStats } from '@/types'

interface DeletePatientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patient: PatientWithStats
  onSuccess: (id: string) => void
}

export function DeletePatientDialog({ open, onOpenChange, patient, onSuccess }: DeletePatientDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const hasConsultations = patient.consultationCount > 0
  const count = patient.consultationCount

  async function handleDelete() {
    setIsDeleting(true)
    const promise = fetch(API.patientId(patient.id), { method: 'DELETE' }).then(async (res) => {
      if (!res.ok) throw new Error('Erro ao excluir paciente')
      return res.json()
    })

    toast.promise(promise, {
      loading: 'Aguarde...',
      success: 'Paciente excluído.',
      error: 'Erro ao excluir paciente.',
    })

    await promise
      .then(() => {
        onOpenChange(false)
        onSuccess(patient.id)
      })
      .catch(() => null)
      .finally(() => setIsDeleting(false))
  }

  return (
    <AppAlertDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Excluir ${patient.name}?`}
      logoId="delete-patient-modal"
      description={
        <div className="space-y-2 text-sm text-muted-foreground">
          {hasConsultations ? (
            <>
              <p>
                Este paciente possui{' '}
                <span className="font-semibold text-foreground">
                  {count} consulta{count !== 1 ? 's' : ''} registrada{count !== 1 ? 's' : ''}
                </span>
                . Ao excluir, todos os registros vinculados serão perdidos permanentemente.
              </p>
              <p className="text-destructive font-medium">Esta ação não pode ser desfeita.</p>
            </>
          ) : (
            <p>Esta ação não pode ser desfeita.</p>
          )}
        </div>
      }
      cancelLabel="Cancelar"
      actionLabel="Excluir"
      actionVariant="destructive"
      actionDisabled={isDeleting}
      onConfirm={handleDelete}
    />
  )
}
