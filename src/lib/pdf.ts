// src/lib/pdf.ts
import jsPDF from 'jspdf'
import type { Patient, Consultation } from '@/types'

interface PDFProps {
  patient: Patient
  consultation: Consultation
  doctorName: string
  doctorCRM: string
  doctorSpecialty: string
}

export async function generatePDFBlob({
  patient,
  consultation,
  doctorName,
  doctorCRM,
  doctorSpecialty,
}: PDFProps): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 20
  const maxW = pageW - margin * 2
  const today = new Date(consultation.updatedAt).toLocaleDateString('pt-BR')
  let y = 20

  const addLine = (text: string, fontSize: number, bold = false, gap = 6) => {
    doc.setFontSize(fontSize)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    const lines = doc.splitTextToSize(text, maxW) as string[]
    lines.forEach((line: string) => {
      if (y > 275) { doc.addPage(); y = 20 }
      doc.text(line, margin, y)
      y += gap
    })
  }

  addLine('ANAMNESE CLÍNICA', 16, true, 8)
  doc.setDrawColor(180, 180, 180)
  doc.line(margin, y, pageW - margin, y)
  y += 6

  addLine(`Data: ${today}`, 10, false, 5)
  y += 3

  addLine('PROFISSIONAL', 11, true, 6)
  if (doctorName) addLine(`Nome: ${doctorName}`, 10, false, 5)
  if (doctorSpecialty) addLine(`Especialidade: ${doctorSpecialty}`, 10, false, 5)
  if (doctorCRM) addLine(`CRM: ${doctorCRM}`, 10, false, 5)
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

  doc.line(margin, y, pageW - margin, y)
  y += 8

  consultation.structuredAnamnesis.sections.forEach(section => {
    addLine(section.title, 13, true, 7)
    y += 1
    addLine(section.content, 11, false, 6)
    y += 6
  })

  return doc.output('blob')
}
