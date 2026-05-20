'use client'

import { useState } from 'react'
import { MoreHorizontal, Pencil, Trash2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { EditPatientSheet } from './edit-patient-sheet'
import { DeletePatientDialog } from './delete-patient-dialog'
import type { PatientWithStats } from '@/types'

interface PatientRowActionsProps {
  patient: PatientWithStats
  onUpdated: (updated: PatientWithStats) => void
  onDeleted: (id: string) => void
  onViewAnamnesis: () => void
}

export function PatientRowActions({ patient, onUpdated, onDeleted, onViewAnamnesis }: PatientRowActionsProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer hover:bg-secondary hover:text-foreground transition-colors">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Ações</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5 mr-2" />
            Editar
          </DropdownMenuItem>
          {patient.consultationCount > 0 && (
            <>
              <DropdownMenuItem onClick={onViewAnamnesis}>
                <FileText className="h-3.5 w-3.5 mr-2" />
                Ver última anamnese
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditPatientSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        patient={patient}
        onSuccess={onUpdated}
      />

      <DeletePatientDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        patient={patient}
        onSuccess={onDeleted}
      />
    </>
  )
}
