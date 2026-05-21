// src/lib/docx.ts
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Header,
  Footer,
  ImageRun,
  AlignmentType,
} from 'docx'
import type { Patient, Consultation } from '@/types'
import type { ClinicData } from '@/lib/clinic'

interface DOCXProps {
  patient: Patient
  consultation: Consultation
  doctorName: string
  doctorCRM: string
  doctorSpecialty: string
  clinic?: ClinicData
}

function formatCnpj(raw: string): string {
  const d = raw.replace(/\D/g, '')
  if (d.length !== 14) return raw
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}

function formatCep(raw: string): string {
  const d = raw.replace(/\D/g, '')
  if (d.length !== 8) return raw
  return `${d.slice(0,5)}-${d.slice(5)}`
}

async function fetchLogoBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    return new Uint8Array(buf)
  } catch {
    return null
  }
}

async function buildHeader(clinic: ClinicData): Promise<Header> {
  const children: Paragraph[] = []

  if (clinic.clinicLogoUrl) {
    const bytes = await fetchLogoBytes(clinic.clinicLogoUrl)
    if (bytes) {
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: bytes,
              transformation: { width: 60, height: 60 },
              type: 'png',
            }),
          ],
          spacing: { after: 80 },
        })
      )
    }
  }

  const lines: string[] = []
  if (clinic.clinicName) lines.push(clinic.clinicName)
  if (clinic.clinicCnpj) lines.push(`CNPJ: ${formatCnpj(clinic.clinicCnpj)}`)
  if (clinic.clinicPhone) lines.push(`Tel: ${clinic.clinicPhone}`)
  if (clinic.clinicEmail) lines.push(`E-mail: ${clinic.clinicEmail}`)
  if (clinic.clinicWebsite) lines.push(`Site: ${clinic.clinicWebsite}`)

  for (const line of lines) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: line, size: 18 })],
        spacing: { after: 40 },
      })
    )
  }

  return new Header({ children })
}

function buildFooter(clinic: ClinicData): Footer {
  const parts: string[] = []

  const addressLine = [clinic.clinicAddress, clinic.clinicCep ? `CEP ${formatCep(clinic.clinicCep)}` : '']
    .filter(Boolean)
    .join(' — ')
  if (addressLine) parts.push(addressLine)

  if (clinic.clinicRtIsSelf) {
    parts.push('Responsável Técnico: próprio profissional')
  } else if (clinic.clinicRtName && clinic.clinicRtRegistry) {
    parts.push(`RT: ${clinic.clinicRtName} — ${clinic.clinicRtRegistry}`)
  }

  if (clinic.clinicBusinessHours) {
    parts.push(`Horário: ${clinic.clinicBusinessHours}`)
  }

  const children = parts.map(
    (text) =>
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, size: 16 })],
        spacing: { after: 40 },
      })
  )

  return new Footer({ children })
}

export async function generateDOCXBlob({
  patient,
  consultation,
  doctorName,
  doctorCRM,
  doctorSpecialty,
  clinic,
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

  const header = clinic ? await buildHeader(clinic) : undefined
  const footer = clinic ? buildFooter(clinic) : undefined

  const doc = new Document({
    sections: [{
      headers: header ? { default: header } : undefined,
      footers: footer ? { default: footer } : undefined,
      children: [...metaLines, ...sectionParagraphs],
    }],
  })

  const buffer = await Packer.toBuffer(doc)
  return new Blob([new Uint8Array(buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}
