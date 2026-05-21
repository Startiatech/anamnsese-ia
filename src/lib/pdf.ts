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

function formatCnpj(v: string): string {
  return v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}
function formatCep(v: string): string {
  return v.replace(/^(\d{5})(\d{3})$/, '$1-$2')
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

export async function generatePDFBlob({
  patient, consultation, doctorName, doctorCRM, doctorSpecialty, clinic,
}: PDFProps): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 20
  const maxW = pageW - margin * 2
  const today = new Date(consultation.updatedAt).toLocaleDateString('pt-BR')
  let y = 20

  // ─── Cabecalho com dados da clinica ───
  if (clinic?.clinicName) {
    let textX = margin
    if (clinic.clinicLogoUrl) {
      const img = await loadImageAsDataUrl(clinic.clinicLogoUrl)
      if (img) {
        try { doc.addImage(img.data, img.format, margin, y, 20, 20) } catch { /* logo malformado: ignora */ }
        textX = margin + 24
      }
    }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14)
    doc.text(clinic.clinicName, textX, y + 5)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
    const line2 = [
      `CNPJ: ${formatCnpj(clinic.clinicCnpj)}`,
      clinic.clinicPhone, clinic.clinicEmail,
    ].filter(Boolean).join('  ·  ')
    doc.text(line2, textX, y + 11)
    if (clinic.clinicWebsite) doc.text(clinic.clinicWebsite, textX, y + 16)
    y += 24
    doc.setDrawColor(200, 200, 200); doc.line(margin, y, pageW - margin, y); y += 6
  }

  const addLine = (text: string, fontSize: number, bold = false, gap = 6) => {
    doc.setFontSize(fontSize); doc.setFont('helvetica', bold ? 'bold' : 'normal')
    const lines = doc.splitTextToSize(text, maxW) as string[]
    lines.forEach((line: string) => {
      if (y > pageH - 30) { doc.addPage(); y = 20 }
      doc.text(line, margin, y); y += gap
    })
  }

  addLine('ANAMNESE CLINICA', 16, true, 8)
  doc.setDrawColor(180, 180, 180); doc.line(margin, y, pageW - margin, y); y += 6
  addLine(`Data: ${today}`, 10, false, 5); y += 3

  addLine('PROFISSIONAL', 11, true, 6)
  if (doctorName) addLine(`Nome: ${doctorName}`, 10, false, 5)
  if (doctorSpecialty) addLine(`Especialidade: ${doctorSpecialty}`, 10, false, 5)
  if (doctorCRM) addLine(`Registro: ${doctorCRM}`, 10, false, 5)
  y += 4

  addLine('PACIENTE', 11, true, 6)
  if (patient.name) addLine(`Nome: ${patient.name}`, 10, false, 5)
  if (patient.cpf) addLine(`CPF: ${patient.cpf}`, 10, false, 5)
  if (patient.birthDate) {
    const [yyyy, mm, dd] = patient.birthDate.split('-')
    addLine(`Data de nascimento: ${dd}/${mm}/${yyyy}`, 10, false, 5)
  }
  if (patient.phone) addLine(`Telefone: ${patient.phone}`, 10, false, 5)
  y += 4

  doc.line(margin, y, pageW - margin, y); y += 8

  consultation.structuredAnamnesis.sections.forEach((section) => {
    addLine(section.title, 13, true, 7); y += 1
    addLine(section.content, 11, false, 6); y += 6
  })

  // ─── Rodape em cada pagina ───
  if (clinic?.clinicName) {
    const pageCount = doc.getNumberOfPages()
    const rtName     = clinic.clinicRtIsSelf ? doctorName : (clinic.clinicRtName ?? '')
    const rtRegistry = clinic.clinicRtIsSelf ? doctorCRM  : (clinic.clinicRtRegistry ?? '')
    const footerLines = [
      `${clinic.clinicAddress}${clinic.clinicAddressNumber ? `, ${clinic.clinicAddressNumber}` : ''} · CEP ${formatCep(clinic.clinicCep)}`,
      rtName ? `Responsavel Tecnico: ${rtName} — ${rtRegistry}` : '',
      clinic.clinicBusinessHours ?? '',
    ].filter(Boolean)
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setDrawColor(220, 220, 220)
      doc.line(margin, pageH - 18, pageW - margin, pageH - 18)
      footerLines.forEach((l, idx) => doc.text(l, margin, pageH - 14 + idx * 4))
    }
  }

  return doc.output('blob')
}
