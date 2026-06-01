'use client'

import { useTransition, useState, useEffect } from 'react'
import { FileText } from 'lucide-react'
import { AppSheet } from '@/components/ui/app-sheet'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { getLatestConsultation } from '@/server/actions/consultation'

interface LastAnamnesisSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patient: { id: string; name: string }
  userId: string
}

export function LastAnamnesisSheet({ open, onOpenChange, patient, userId }: LastAnamnesisSheetProps) {
  const [consultation, setConsultation] = useState<Awaited<ReturnType<typeof getLatestConsultation>>>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    startTransition(async () => {
      const result = await getLatestConsultation(patient.id, userId)
      setConsultation(result)
    })
  }, [open, patient.id, userId])

  return (
    <AppSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Última anamnese — ${patient.name}`}
      description="Resultado da última consulta registrada."
      icon={<FileText className="h-4 w-4 text-primary" />}
      hideFooter
    >
      {isPending && (
        <p className="text-sm text-muted-foreground animate-pulse">Carregando...</p>
      )}

      {!isPending && !consultation && (
        <Empty className="border-0 py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon"><FileText /></EmptyMedia>
            <EmptyTitle className="text-sm font-medium">Nenhuma anamnese encontrada</EmptyTitle>
            <EmptyDescription className="text-xs">Este paciente ainda não possui anamneses registradas.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {!isPending && consultation && (
        <div className="space-y-5">
          {consultation.structuredAnamnesis.sections.map((section) => (
            <div key={section.title}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                {section.title}
              </h3>
              <p className="text-sm text-foreground whitespace-pre-wrap">{section.content}</p>
            </div>
          ))}
        </div>
      )}
    </AppSheet>
  )
}
