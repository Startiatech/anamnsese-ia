// src/lib/docx.ts
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Header,
  Footer,
  ImageRun,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  PageNumber,
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

const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

const MUTED_HEX = '6E6E78'
const TEXT_HEX = '1E1E23'
const RULE_HEX = 'C8C8D2'

function formatCnpj(raw: string): string {
  const d = raw.replace(/\D/g, '')
  if (d.length !== 14) return raw
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

function formatCep(raw: string): string {
  const d = raw.replace(/\D/g, '')
  if (d.length !== 8) return raw
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

function formatDateLong(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} de ${MONTHS_PT[d.getMonth()]} de ${d.getFullYear()}`
}

function formatBirthDate(iso: string): string {
  const [yyyy, mm, dd] = iso.split('-')
  return `${dd}/${mm}/${yyyy}`
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
              transformation: { width: 56, height: 56 },
              type: 'png',
            }),
          ],
          spacing: { after: 60 },
        }),
      )
    }
  }

  if (clinic.clinicName) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: clinic.clinicName, bold: true, size: 28, color: TEXT_HEX, font: 'Calibri' }),
        ],
        spacing: { after: 30 },
      }),
    )
  }

  const contact1 = [
    clinic.clinicCnpj ? `CNPJ ${formatCnpj(clinic.clinicCnpj)}` : '',
    clinic.clinicPhone,
    clinic.clinicEmail,
  ].filter(Boolean).join('  ·  ')

  if (contact1) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: contact1, size: 16, color: MUTED_HEX, font: 'Calibri' })],
        spacing: { after: 20 },
      }),
    )
  }

  if (clinic.clinicWebsite) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: clinic.clinicWebsite, size: 16, color: MUTED_HEX, font: 'Calibri' })],
        spacing: { after: 80 },
      }),
    )
  }

  children.push(
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE_HEX, space: 1 } },
      spacing: { after: 0 },
    }),
  )

  return new Header({ children })
}

function buildFooter(clinic: ClinicData, doctorName: string, doctorCRM: string): Footer {
  const children: Paragraph[] = []

  children.push(
    new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: RULE_HEX, space: 1 } },
      spacing: { after: 40 },
    }),
  )

  const addressFull = `${clinic.clinicAddress}${clinic.clinicAddressNumber ? `, ${clinic.clinicAddressNumber}` : ''} · CEP ${formatCep(clinic.clinicCep)}`
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: addressFull, size: 14, color: MUTED_HEX, font: 'Calibri' })],
      spacing: { after: 20 },
    }),
  )

  const rtName = clinic.clinicRtIsSelf ? doctorName : (clinic.clinicRtName ?? '')
  const rtRegistry = clinic.clinicRtIsSelf ? doctorCRM : (clinic.clinicRtRegistry ?? '')
  if (rtName) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `Responsável Técnico: ${rtName} — ${rtRegistry}`, size: 14, color: MUTED_HEX, font: 'Calibri' })],
        spacing: { after: 20 },
      }),
    )
  }

  if (clinic.clinicBusinessHours) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: clinic.clinicBusinessHours, size: 14, color: MUTED_HEX, font: 'Calibri' })],
        spacing: { after: 60 },
      }),
    )
  }

  // Paginação
  children.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({ text: 'Página ', size: 14, color: MUTED_HEX, font: 'Calibri' }),
        new TextRun({ children: [PageNumber.CURRENT], size: 14, color: MUTED_HEX, font: 'Calibri' }),
        new TextRun({ text: ' de ', size: 14, color: MUTED_HEX, font: 'Calibri' }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: MUTED_HEX, font: 'Calibri' }),
      ],
    }),
  )

  return new Footer({ children })
}

function metaCell(label: string, value: string): TableCell {
  return new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    borders: {
      top:    { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      left:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right:  { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    },
    children: [
      new Paragraph({
        children: [new TextRun({ text: label.toUpperCase(), size: 14, color: TEXT_HEX, font: 'Calibri', bold: true })],
        spacing: { after: 40 },
      }),
      ...(value
        ? [new Paragraph({
            children: [new TextRun({ text: value, size: 20, color: TEXT_HEX, font: 'Times New Roman' })],
            spacing: { after: 20 },
          })]
        : []),
    ],
  })
}

function buildMetaBlock(
  title: string,
  rows: { label: string; value: string }[],
): Paragraph[] {
  const out: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: title.toUpperCase(), size: 16, color: TEXT_HEX, bold: true, font: 'Calibri' })],
      spacing: { after: 80 },
    }),
  ]
  for (const { label, value } of rows) {
    if (!value) continue
    out.push(
      new Paragraph({
        children: [new TextRun({ text: label.toUpperCase(), size: 14, color: MUTED_HEX, font: 'Calibri' })],
        spacing: { after: 20 },
      }),
      new Paragraph({
        children: [new TextRun({ text: value, size: 20, color: TEXT_HEX, font: 'Times New Roman' })],
        spacing: { after: 60 },
      }),
    )
  }
  return out
}

export async function generateDOCXBlob({
  patient,
  consultation,
  doctorName,
  doctorCRM,
  doctorSpecialty,
  clinic,
}: DOCXProps): Promise<Blob> {
  const children: (Paragraph | Table)[] = []

  // Título
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'ANAMNESE CLÍNICA', bold: true, size: 34, color: TEXT_HEX, font: 'Calibri' })],
      spacing: { before: 200, after: 240 },
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: formatDateLong(consultation.updatedAt), size: 18, color: MUTED_HEX, font: 'Calibri' })],
      spacing: { after: 200 },
    }),
  )

  // Blocos Profissional / Paciente em tabela lado a lado
  const profCell = new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    borders: {
      top:    { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      left:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right:  { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    },
    children: buildMetaBlock('Profissional', [
      { label: 'Nome',          value: doctorName },
      { label: 'Especialidade', value: doctorSpecialty },
      { label: 'Registro',      value: doctorCRM },
    ]),
  })
  void metaCell // dummy reference to keep type used if unused above

  const patCell = new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    borders: {
      top:    { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      left:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right:  { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    },
    children: buildMetaBlock('Paciente', [
      { label: 'Nome',       value: patient.name },
      { label: 'CPF',        value: patient.cpf ?? '' },
      { label: 'Nascimento', value: patient.birthDate ? formatBirthDate(patient.birthDate) : '' },
      { label: 'Telefone',   value: patient.phone ?? '' },
    ]),
  })

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({ children: [profCell, patCell] })],
    }),
  )

  // Separador entre meta e seções
  children.push(
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE_HEX, space: 1 } },
      spacing: { before: 200, after: 200 },
    }),
  )

  // Seções
  for (const s of consultation.structuredAnamnesis.sections) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: s.title.toUpperCase(), bold: true, size: 22, color: TEXT_HEX, font: 'Calibri' })],
        spacing: { before: 200, after: 120 },
      }),
      new Paragraph({
        children: [new TextRun({ text: s.content, size: 22, color: TEXT_HEX, font: 'Times New Roman' })],
        spacing: { after: 200 },
      }),
    )
  }

  const header = clinic ? await buildHeader(clinic) : undefined
  const footer = clinic ? buildFooter(clinic, doctorName, doctorCRM) : undefined

  const doc = new Document({
    sections: [{
      headers: header ? { default: header } : undefined,
      footers: footer ? { default: footer } : undefined,
      properties: {
        page: { margin: { top: 1100, right: 1300, bottom: 1100, left: 1300 } },
      },
      children,
    }],
  })

  const buffer = await Packer.toBuffer(doc)
  return new Blob([new Uint8Array(buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}
