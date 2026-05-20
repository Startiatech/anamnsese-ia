// src/components/export/ExportButtons.tsx
'use client'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { Patient, Consultation } from '@/types'

interface Professional {
  name: string
  specialty: string
  crm: string
}

interface ExportButtonsProps {
  patient: Patient
  consultation: Consultation
  professional: Professional
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function safeFilename(name: string): string {
  return name.replace(/\s+/g, '-').toLowerCase()
}

export function ExportButtons({ patient, consultation, professional }: ExportButtonsProps) {
  function handleExportPDF() {
    toast.promise(
      import('@/lib/pdf').then(({ generatePDFBlob }) =>
        generatePDFBlob({
          patient,
          consultation,
          doctorName: professional.name,
          doctorCRM: professional.crm,
          doctorSpecialty: professional.specialty,
        })
      ).then((blob) => {
        downloadBlob(blob, `anamnese-${safeFilename(patient.name)}.pdf`)
      }),
      { loading: 'Aguarde...', success: 'PDF exportado!', error: (err: Error) => err.message || 'Erro ao gerar PDF.' }
    )
  }

  function handleExportDOCX() {
    toast.promise(
      import('@/lib/docx').then(({ generateDOCXBlob }) =>
        generateDOCXBlob({
          patient,
          consultation,
          doctorName: professional.name,
          doctorCRM: professional.crm,
          doctorSpecialty: professional.specialty,
        })
      ).then((blob) => {
        downloadBlob(blob, `anamnese-${safeFilename(patient.name)}.docx`)
      }),
      { loading: 'Aguarde...', success: 'DOCX exportado!', error: (err: Error) => err.message || 'Erro ao gerar DOCX.' }
    )
  }

  return (
    <div className="flex gap-3">
      <Button onClick={handleExportPDF}>Exportar PDF</Button>
      <Button variant="outline" onClick={handleExportDOCX}>Exportar DOCX</Button>
    </div>
  )
}
