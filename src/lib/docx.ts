// src/lib/docx.ts
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'
import type { Patient, Consultation } from '@/types'

interface DOCXProps {
  patient: Patient
  consultation: Consultation
  doctorName: string
  doctorCRM: string
  doctorSpecialty: string
}

export async function generateDOCXBlob({
  patient,
  consultation,
  doctorName,
  doctorCRM,
  doctorSpecialty,
}: DOCXProps): Promise<Blob> {
  const today = new Date(consultation.updatedAt).toLocaleDateString('pt-BR')

  const metaLines: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: 'ANAMNESE CLÍNICA', bold: true, size: 32 })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Data: ${today}`, size: 20 })],
      spacing: { after: 240 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'PROFISSIONAL', bold: true, size: 22 })],
      spacing: { after: 80 },
    }),
    ...(doctorName ? [new Paragraph({ children: [new TextRun({ text: `Nome: ${doctorName}`, size: 20 })], spacing: { after: 60 } })] : []),
    ...(doctorSpecialty ? [new Paragraph({ children: [new TextRun({ text: `Especialidade: ${doctorSpecialty}`, size: 20 })], spacing: { after: 60 } })] : []),
    ...(doctorCRM ? [new Paragraph({ children: [new TextRun({ text: `CRM: ${doctorCRM}`, size: 20 })], spacing: { after: 60 } })] : []),
    new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 120 } }),
    new Paragraph({
      children: [new TextRun({ text: 'PACIENTE', bold: true, size: 22 })],
      spacing: { after: 80 },
    }),
    ...(patient.name ? [new Paragraph({ children: [new TextRun({ text: `Nome: ${patient.name}`, size: 20 })], spacing: { after: 60 } })] : []),
    ...(patient.cpf ? [new Paragraph({ children: [new TextRun({ text: `CPF: ${patient.cpf}`, size: 20 })], spacing: { after: 60 } })] : []),
    ...(patient.birthDate ? (() => {
      const [yyyy, mm, dd] = patient.birthDate!.split('-')
      return [new Paragraph({ children: [new TextRun({ text: `Data de nascimento: ${dd}/${mm}/${yyyy}`, size: 20 })], spacing: { after: 60 } })]
    })() : []),
    ...(patient.phone ? [new Paragraph({ children: [new TextRun({ text: `Telefone: ${patient.phone}`, size: 20 })], spacing: { after: 60 } })] : []),
    new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 200 } }),
  ]

  const sectionParagraphs = consultation.structuredAnamnesis.sections.flatMap(s => [
    new Paragraph({ text: s.title, heading: HeadingLevel.HEADING_2 }),
    new Paragraph({
      children: [new TextRun({ text: s.content, size: 20 })],
      spacing: { after: 200 },
    }),
  ])

  const doc = new Document({
    sections: [{
      children: [...metaLines, ...sectionParagraphs],
    }],
  })

  const buffer = await Packer.toBuffer(doc)
  return new Blob([new Uint8Array(buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}
