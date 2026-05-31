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
  VerticalAlign,
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

// Move a letra entre parênteses do fim para o início do título da seção:
// "Subjetivo (S)" → "(S) Subjetivo". Títulos sem parênteses passam intactos.
function formatSectionTitle(title: string): string {
  const m = title.match(/^(.*?)\s*\(([^)]+)\)\s*$/)
  return m ? `(${m[2]}) ${m[1]}` : title
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
  // Bloco de texto da clínica, centralizado.
  const textParagraphs: Paragraph[] = []

  if (clinic.clinicName) {
    textParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: clinic.clinicName, bold: true, size: 28, color: TEXT_HEX, font: 'Times New Roman' }),
        ],
        spacing: { after: 30 },
      }),
    )
  }

  const addressFull = clinic.clinicAddress
    ? `${clinic.clinicAddress}${clinic.clinicAddressNumber ? `, ${clinic.clinicAddressNumber}` : ''} · CEP ${formatCep(clinic.clinicCep)}`
    : ''
  if (addressFull) {
    textParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: addressFull, size: 16, color: MUTED_HEX, font: 'Times New Roman' })],
        spacing: { after: 20 },
      }),
    )
  }

  const contact1 = [
    clinic.clinicCnpj ? `CNPJ ${formatCnpj(clinic.clinicCnpj)}` : '',
    clinic.clinicPhone,
    clinic.clinicEmail,
  ].filter(Boolean).join('  ·  ')

  if (contact1) {
    textParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: contact1, size: 16, color: MUTED_HEX, font: 'Times New Roman' })],
        spacing: { after: clinic.clinicWebsite ? 20 : 20 },
      }),
    )
  }

  if (clinic.clinicWebsite) {
    textParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: clinic.clinicWebsite, size: 16, color: MUTED_HEX, font: 'Times New Roman' })],
        spacing: { after: 20 },
      }),
    )
  }

  const children: (Paragraph | Table)[] = []

  let logoBytes: Uint8Array | null = null
  if (clinic.clinicLogoUrl) logoBytes = await fetchLogoBytes(clinic.clinicLogoUrl)

  if (logoBytes) {
    // Logo à esquerda, texto centralizado: tabela de 2 colunas sem bordas.
    const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
    const cellBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }
    const logoCell = new TableCell({
      width: { size: 18, type: WidthType.PERCENTAGE },
      borders: cellBorders,
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          children: [
            new ImageRun({ data: logoBytes, transformation: { width: 56, height: 56 }, type: 'png' }),
          ],
        }),
      ],
    })
    const textCell = new TableCell({
      width: { size: 82, type: WidthType.PERCENTAGE },
      borders: cellBorders,
      verticalAlign: VerticalAlign.CENTER,
      children: textParagraphs,
    })
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [new TableRow({ children: [logoCell, textCell] })],
      }),
    )
  } else {
    children.push(...textParagraphs)
  }

  children.push(
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE_HEX, space: 1 } },
      spacing: { before: 80, after: 0 },
    }),
  )

  return new Header({ children })
}

function buildFooter(doctorName: string, doctorCRM: string, doctorSpecialty: string): Footer {
  const children: Paragraph[] = []

  children.push(
    new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: RULE_HEX, space: 1 } },
      spacing: { after: 40 },
    }),
  )

  // Dados do profissional, centralizados.
  const nameLine = [doctorName, doctorSpecialty].filter(Boolean).join(' — ')
  if (nameLine) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: nameLine, size: 16, color: MUTED_HEX, font: 'Times New Roman' })],
        spacing: { after: 20 },
      }),
    )
  }

  if (doctorCRM) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: doctorCRM, size: 16, color: MUTED_HEX, font: 'Times New Roman' })],
        spacing: { after: 60 },
      }),
    )
  }

  // Paginação
  children.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({ text: 'Página ', size: 14, color: MUTED_HEX, font: 'Times New Roman' }),
        new TextRun({ children: [PageNumber.CURRENT], size: 14, color: MUTED_HEX, font: 'Times New Roman' }),
        new TextRun({ text: ' de ', size: 14, color: MUTED_HEX, font: 'Times New Roman' }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: MUTED_HEX, font: 'Times New Roman' }),
      ],
    }),
  )

  return new Footer({ children })
}

function buildMetaBlock(
  title: string,
  rows: { label: string; value: string }[],
): Paragraph[] {
  const out: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: title.toUpperCase(), size: 16, color: TEXT_HEX, bold: true, font: 'Times New Roman' })],
      spacing: { after: 80 },
    }),
  ]
  for (const { label, value } of rows) {
    if (!value) continue
    out.push(
      new Paragraph({
        children: [new TextRun({ text: `${label}: ${value}`, size: 20, color: TEXT_HEX, font: 'Times New Roman' })],
        spacing: { after: 40 },
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

  // Título à esquerda + data à direita, na mesma linha (tabela invisível).
  const noBorderTitle = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  const titleCellBorders = { top: noBorderTitle, bottom: noBorderTitle, left: noBorderTitle, right: noBorderTitle }
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 65, type: WidthType.PERCENTAGE },
              borders: titleCellBorders,
              verticalAlign: VerticalAlign.BOTTOM,
              children: [
                new Paragraph({
                  alignment: AlignmentType.LEFT,
                  children: [new TextRun({ text: 'ANAMNESE CLÍNICA', bold: true, size: 34, color: TEXT_HEX, font: 'Times New Roman' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 35, type: WidthType.PERCENTAGE },
              borders: titleCellBorders,
              verticalAlign: VerticalAlign.BOTTOM,
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [new TextRun({ text: formatDateLong(consultation.updatedAt), size: 18, color: MUTED_HEX, font: 'Times New Roman' })],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  )

  // Dados do paciente (o profissional fica no rodapé).
  children.push(
    new Paragraph({ spacing: { after: 120 } }),
    ...buildMetaBlock('Paciente', [
      { label: 'Nome',       value: patient.name },
      { label: 'CPF',        value: patient.cpf ?? '' },
      { label: 'Nascimento', value: patient.birthDate ? formatBirthDate(patient.birthDate) : '' },
      { label: 'Telefone',   value: patient.phone ?? '' },
    ]),
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
        children: [new TextRun({ text: formatSectionTitle(s.title).toUpperCase(), bold: true, size: 22, color: TEXT_HEX, font: 'Times New Roman' })],
        spacing: { before: 200, after: 120 },
      }),
      new Paragraph({
        children: [new TextRun({ text: s.content, size: 22, color: TEXT_HEX, font: 'Times New Roman' })],
        spacing: { after: 200 },
      }),
    )
  }

  const header = clinic ? await buildHeader(clinic) : undefined
  const footer = doctorName ? buildFooter(doctorName, doctorCRM, doctorSpecialty) : undefined

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
