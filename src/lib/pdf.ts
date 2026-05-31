// src/lib/pdf.ts
import jsPDF from 'jspdf'
import type { Patient, Consultation } from '@/types'
import type { ClinicData } from './clinic'
import { buildAnamnesisDocModel, computeLogoBox } from '@/lib/anamnesis-document-model'

interface PDFProps {
  patient: Patient
  consultation: Consultation
  doctorName: string
  doctorCRM: string
  doctorSpecialty: string
  clinic?: ClinicData
}

async function loadImageAsDataUrl(url: string): Promise<{ data: string; format: 'PNG' | 'JPEG' | 'WEBP' } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const reader = new FileReader()
    return await new Promise((resolve) => {
      reader.onloadend = () => {
        const data = reader.result as string
        const format = blob.type === 'image/jpeg' ? 'JPEG' : blob.type === 'image/webp' ? 'WEBP' : 'PNG'
        resolve({ data, format })
      }
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch { return null }
}

const COLORS = {
  text:  [25, 25, 25] as [number, number, number],
  muted: [110, 110, 110] as [number, number, number],
  rule:  [200, 200, 200] as [number, number, number],
}

// Altura-alvo da logo no PDF (mm). A largura é proporcional à imagem real.
const LOGO_TARGET_HEIGHT_MM = 22

export async function generatePDFBlob({
  patient, consultation, doctorName, doctorCRM, doctorSpecialty, clinic,
}: PDFProps): Promise<Blob> {
  const model = buildAnamnesisDocModel({
    patient,
    professional: { name: doctorName, specialty: doctorSpecialty, crm: doctorCRM },
    clinic,
    structuredAnamnesis: consultation.structuredAnamnesis,
    updatedAt: consultation.updatedAt,
  })

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const MARGIN_X = 25
  const MARGIN_TOP = 20
  const MARGIN_BOTTOM = 28
  const contentW = pageW - MARGIN_X * 2
  const centerX = pageW / 2
  let y = MARGIN_TOP

  // Fonte única serifada em todo o documento (equivale ao Times New Roman).
  function setColor(rgb: [number, number, number]) {
    doc.setTextColor(rgb[0], rgb[1], rgb[2])
  }

  function checkPageBreak(needed: number) {
    if (y + needed > pageH - MARGIN_BOTTOM) {
      doc.addPage()
      y = MARGIN_TOP
    }
  }

  // ─── Cabeçalho institucional — dados centralizados, logo à esquerda ─────────
  if (model.clinic) {
    const headerStart = y
    let logoH = 0
    let textCenter = centerX

    if (model.clinic.logoUrl) {
      const img = await loadImageAsDataUrl(model.clinic.logoUrl)
      if (img) {
        try {
          const props = doc.getImageProperties(img.data)
          const box = computeLogoBox(props.width, props.height, LOGO_TARGET_HEIGHT_MM)
          doc.addImage(img.data, img.format, MARGIN_X, headerStart, box.width, box.height)
          logoH = box.height
          // Centraliza o texto no espaço à direita da logo (sem colar nela).
          const textLeft = MARGIN_X + box.width + 6
          textCenter = (textLeft + (pageW - MARGIN_X)) / 2
        } catch { /* logo malformado */ }
      }
    }

    // Bloco de texto centralizado (na página, ou à direita da logo se houver).
    let ty = headerStart + 5
    setColor(COLORS.text)
    doc.setFont('times', 'bold').setFontSize(15)
    doc.text(model.clinic.name, textCenter, ty, { align: 'center' })
    ty += 5.5

    setColor(COLORS.muted)
    doc.setFont('times', 'normal').setFontSize(8.5)
    if (model.clinic.addressLine) {
      doc.text(model.clinic.addressLine, textCenter, ty, { align: 'center' })
      ty += 4.5
    }
    if (model.clinic.contactLine) {
      doc.text(model.clinic.contactLine, textCenter, ty, { align: 'center' })
      ty += 4.5
    }
    if (model.clinic.website) {
      doc.text(model.clinic.website, textCenter, ty, { align: 'center' })
      ty += 4.5
    }

    y = Math.max(headerStart + logoH, ty) + 4

    doc.setDrawColor(COLORS.rule[0], COLORS.rule[1], COLORS.rule[2]).setLineWidth(0.3)
    doc.line(MARGIN_X, y, pageW - MARGIN_X, y)
    y += 10
  }

  // ─── Título à esquerda + data à direita, na mesma linha ─────────────────────
  setColor(COLORS.text)
  doc.setFont('times', 'bold').setFontSize(17)
  doc.text(model.title, MARGIN_X, y)
  setColor(COLORS.muted)
  doc.setFont('times', 'normal').setFontSize(9.5)
  doc.text(model.dateLong, pageW - MARGIN_X, y, { align: 'right' })
  y += 10

  // ─── Bloco do paciente ──────────────────────────────────────────────────────
  setColor(COLORS.text)
  doc.setFont('times', 'bold').setFontSize(9)
  doc.text('PACIENTE', MARGIN_X, y)
  y += 6

  doc.setFont('times', 'normal').setFontSize(10.5)
  model.patientLines.forEach(({ label, value }) => {
    const wrapped = doc.splitTextToSize(`${label}: ${value}`, contentW) as string[]
    wrapped.forEach((w) => {
      setColor(COLORS.text)
      doc.text(w, MARGIN_X, y)
      y += 4.5
    })
  })
  y += 4

  // Separador antes do corpo
  doc.setDrawColor(COLORS.rule[0], COLORS.rule[1], COLORS.rule[2]).setLineWidth(0.2)
  doc.line(MARGIN_X, y, pageW - MARGIN_X, y)
  y += 8

  // ─── Seções da anamnese ─────────────────────────────────────────────────────
  model.sections.forEach((section) => {
    checkPageBreak(14)
    setColor(COLORS.text)
    doc.setFont('times', 'bold').setFontSize(10.5)
    doc.text(section.title.toUpperCase(), MARGIN_X, y)
    y += 6

    doc.setFont('times', 'normal').setFontSize(11)
    const wrapped = doc.splitTextToSize(section.content, contentW) as string[]
    wrapped.forEach((line) => {
      checkPageBreak(5)
      doc.text(line, MARGIN_X, y)
      y += 5.2
    })
    y += 6
  })

  // ─── Rodapé em cada página — dados do profissional, centralizados ───────────
  const pageCount = doc.getNumberOfPages()
  const footer = model.professionalFooter

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)

    if (footer) {
      doc.setDrawColor(COLORS.rule[0], COLORS.rule[1], COLORS.rule[2]).setLineWidth(0.2)
      doc.line(MARGIN_X, pageH - 20, pageW - MARGIN_X, pageH - 20)

      setColor(COLORS.muted)
      doc.setFont('times', 'normal').setFontSize(8.5)
      if (footer.nameLine) {
        doc.text(footer.nameLine, centerX, pageH - 15, { align: 'center' })
      }
      if (footer.crm) {
        doc.text(footer.crm, centerX, pageH - 11, { align: 'center' })
      }
    }

    // Paginação (sempre)
    setColor(COLORS.muted)
    doc.setFont('times', 'normal').setFontSize(7.5)
    doc.text(`Página ${i} de ${pageCount}`, pageW - MARGIN_X, pageH - 7, { align: 'right' })
  }

  return doc.output('blob')
}
