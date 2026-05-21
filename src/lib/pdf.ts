// src/lib/pdf.ts
import jsPDF from 'jspdf'
import type { Patient, Consultation } from '@/types'
import type { ClinicData } from './clinic'

interface PDFProps {
  patient: Patient
  consultation: Consultation
  doctorName: string
  doctorCRM: string
  doctorSpecialty: string
  clinic?: ClinicData
}

const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

function formatCnpj(v: string): string {
  return v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

function formatCep(v: string): string {
  return v.replace(/^(\d{5})(\d{3})$/, '$1-$2')
}

function formatDateLong(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} de ${MONTHS_PT[d.getMonth()]} de ${d.getFullYear()}`
}

function formatBirthDate(iso: string): string {
  const [yyyy, mm, dd] = iso.split('-')
  return `${dd}/${mm}/${yyyy}`
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
  text:    [30, 30, 35] as [number, number, number],
  muted:   [110, 110, 120] as [number, number, number],
  rule:    [200, 200, 210] as [number, number, number],
  brand:   [124, 58, 237] as [number, number, number], // violet-600
}

export async function generatePDFBlob({
  patient, consultation, doctorName, doctorCRM, doctorSpecialty, clinic,
}: PDFProps): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const MARGIN_X = 25
  const MARGIN_TOP = 20
  const MARGIN_BOTTOM = 28
  const contentW = pageW - MARGIN_X * 2
  let y = MARGIN_TOP

  function setColor(rgb: [number, number, number]) {
    doc.setTextColor(rgb[0], rgb[1], rgb[2])
  }

  function checkPageBreak(needed: number) {
    if (y + needed > pageH - MARGIN_BOTTOM) {
      doc.addPage()
      y = MARGIN_TOP
    }
  }

  // ─── Cabeçalho institucional ───────────────────────────────────────────────
  if (clinic?.clinicName) {
    const headerStart = y
    let textX = MARGIN_X
    let logoH = 0

    if (clinic.clinicLogoUrl) {
      const img = await loadImageAsDataUrl(clinic.clinicLogoUrl)
      if (img) {
        try {
          doc.addImage(img.data, img.format, MARGIN_X, headerStart, 22, 22)
          textX = MARGIN_X + 26
          logoH = 22
        } catch { /* logo malformado */ }
      }
    }

    // Nome da clínica (sans-serif, brand color)
    setColor(COLORS.brand)
    doc.setFont('helvetica', 'bold').setFontSize(15)
    doc.text(clinic.clinicName, textX, headerStart + 6)

    // Contato (linha 1)
    setColor(COLORS.muted)
    doc.setFont('helvetica', 'normal').setFontSize(8.5)
    const contact1 = [
      `CNPJ ${formatCnpj(clinic.clinicCnpj)}`,
      clinic.clinicPhone,
      clinic.clinicEmail,
    ].filter(Boolean).join('  ·  ')
    doc.text(contact1, textX, headerStart + 11)

    // Site (linha 2)
    if (clinic.clinicWebsite) {
      doc.text(clinic.clinicWebsite, textX, headerStart + 15.5)
    }

    y = headerStart + Math.max(logoH, 18) + 4

    // Linha decorativa
    doc.setDrawColor(COLORS.brand[0], COLORS.brand[1], COLORS.brand[2]).setLineWidth(0.6)
    doc.line(MARGIN_X, y, pageW - MARGIN_X, y)
    doc.setDrawColor(COLORS.rule[0], COLORS.rule[1], COLORS.rule[2]).setLineWidth(0.2)
    doc.line(MARGIN_X, y + 1, pageW - MARGIN_X, y + 1)
    y += 10
  }

  // ─── Título do documento ───────────────────────────────────────────────────
  setColor(COLORS.text)
  doc.setFont('helvetica', 'bold').setFontSize(17)
  doc.text('ANAMNESE CLÍNICA', pageW / 2, y, { align: 'center' })
  y += 5
  doc.setDrawColor(COLORS.brand[0], COLORS.brand[1], COLORS.brand[2]).setLineWidth(0.5)
  doc.line(pageW / 2 - 18, y, pageW / 2 + 18, y)
  y += 8

  // ─── Data e local (estilo carta) ───────────────────────────────────────────
  setColor(COLORS.muted)
  doc.setFont('helvetica', 'normal').setFontSize(9.5)
  doc.text(formatDateLong(consultation.updatedAt), pageW - MARGIN_X, y, { align: 'right' })
  y += 8

  // ─── Blocos Profissional / Paciente lado a lado ────────────────────────────
  const blockW = (contentW - 6) / 2
  const blockStartY = y

  function drawBlock(label: string, lines: { label: string; value: string }[], xOffset: number) {
    let by = blockStartY
    // Header do bloco
    setColor(COLORS.brand)
    doc.setFont('helvetica', 'bold').setFontSize(8)
    doc.text(label.toUpperCase(), MARGIN_X + xOffset, by)
    by += 2
    doc.setDrawColor(COLORS.brand[0], COLORS.brand[1], COLORS.brand[2]).setLineWidth(0.3)
    doc.line(MARGIN_X + xOffset, by, MARGIN_X + xOffset + blockW, by)
    by += 4

    // Conteúdo
    lines.forEach(({ label: l, value }) => {
      if (!value) return
      setColor(COLORS.muted)
      doc.setFont('helvetica', 'normal').setFontSize(8)
      doc.text(l.toUpperCase(), MARGIN_X + xOffset, by)
      by += 3.5
      setColor(COLORS.text)
      doc.setFont('times', 'normal').setFontSize(10.5)
      const wrapped = doc.splitTextToSize(value, blockW) as string[]
      wrapped.forEach((w) => { doc.text(w, MARGIN_X + xOffset, by); by += 4 })
      by += 1
    })
    return by
  }

  const profLines = [
    { label: 'Nome',         value: doctorName },
    { label: 'Especialidade', value: doctorSpecialty },
    { label: 'Registro',     value: doctorCRM },
  ]
  const patLines = [
    { label: 'Nome',           value: patient.name },
    { label: 'CPF',            value: patient.cpf ?? '' },
    { label: 'Nascimento',     value: patient.birthDate ? formatBirthDate(patient.birthDate) : '' },
    { label: 'Telefone',       value: patient.phone ?? '' },
  ]

  const profEndY = drawBlock('Profissional', profLines, 0)
  const patEndY  = drawBlock('Paciente',     patLines, blockW + 6)
  y = Math.max(profEndY, patEndY) + 4

  // Separador antes do corpo
  doc.setDrawColor(COLORS.rule[0], COLORS.rule[1], COLORS.rule[2]).setLineWidth(0.2)
  doc.line(MARGIN_X, y, pageW - MARGIN_X, y)
  y += 8

  // ─── Seções da anamnese ────────────────────────────────────────────────────
  consultation.structuredAnamnesis.sections.forEach((section) => {
    checkPageBreak(14)
    // Título da seção
    setColor(COLORS.brand)
    doc.setFont('helvetica', 'bold').setFontSize(10.5)
    doc.text(section.title.toUpperCase(), MARGIN_X, y)
    y += 2.5
    doc.setDrawColor(COLORS.brand[0], COLORS.brand[1], COLORS.brand[2]).setLineWidth(0.3)
    doc.line(MARGIN_X, y, MARGIN_X + 35, y)
    y += 5

    // Corpo
    setColor(COLORS.text)
    doc.setFont('times', 'normal').setFontSize(11)
    const wrapped = doc.splitTextToSize(section.content, contentW) as string[]
    wrapped.forEach((line) => {
      checkPageBreak(5)
      doc.text(line, MARGIN_X, y)
      y += 5.2
    })
    y += 5
  })

  // ─── Rodapé em cada página ─────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages()
  const rtName     = clinic?.clinicRtIsSelf ? doctorName : (clinic?.clinicRtName ?? '')
  const rtRegistry = clinic?.clinicRtIsSelf ? doctorCRM  : (clinic?.clinicRtRegistry ?? '')

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)

    if (clinic?.clinicName) {
      doc.setDrawColor(COLORS.rule[0], COLORS.rule[1], COLORS.rule[2]).setLineWidth(0.2)
      doc.line(MARGIN_X, pageH - 22, pageW - MARGIN_X, pageH - 22)

      setColor(COLORS.muted)
      doc.setFont('helvetica', 'normal').setFontSize(7.5)

      const addressFull = `${clinic.clinicAddress}${clinic.clinicAddressNumber ? `, ${clinic.clinicAddressNumber}` : ''} · CEP ${formatCep(clinic.clinicCep)}`
      doc.text(addressFull, pageW / 2, pageH - 18, { align: 'center' })

      if (rtName) {
        doc.text(`Responsável Técnico: ${rtName} — ${rtRegistry}`, pageW / 2, pageH - 14.5, { align: 'center' })
      }

      if (clinic.clinicBusinessHours) {
        doc.text(clinic.clinicBusinessHours, pageW / 2, pageH - 11, { align: 'center' })
      }
    }

    // Paginação (sempre, mesmo sem clinic)
    setColor(COLORS.muted)
    doc.setFont('helvetica', 'normal').setFontSize(7.5)
    doc.text(`Página ${i} de ${pageCount}`, pageW - MARGIN_X, pageH - 7, { align: 'right' })
  }

  return doc.output('blob')
}
