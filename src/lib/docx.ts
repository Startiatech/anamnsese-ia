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
import {
  buildAnamnesisDocModel,
  computeLogoBox,
  type AnamnesisDocModel,
  type AnamnesisDocClinic,
  type AnamnesisDocFooter,
  type AnamnesisDocLine,
} from '@/lib/anamnesis-document-model'

interface DOCXProps {
  patient: Patient
  consultation: Consultation
  doctorName: string
  doctorCRM: string
  doctorSpecialty: string
  clinic?: ClinicData
}

const MUTED_HEX = '6E6E78'
const TEXT_HEX = '1E1E23'
const RULE_HEX = 'C8C8D2'
const FONT = 'Times New Roman'

// Altura-alvo da logo (~22mm a 96dpi). A largura é proporcional à imagem real.
const LOGO_TARGET_HEIGHT_PX = 83

interface LoadedLogo {
  bytes: Uint8Array
  width: number
  height: number
  type: 'png' | 'jpg'
}

async function loadLogo(url: string): Promise<LoadedLogo | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const buf = await blob.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let natW = 0
    let natH = 0
    try {
      const bmp = await createImageBitmap(blob)
      natW = bmp.width
      natH = bmp.height
      bmp.close()
    } catch { /* sem dimensões → cai para quadrado */ }
    const type = blob.type === 'image/jpeg' ? 'jpg' : 'png'
    return { bytes, width: natW, height: natH, type }
  } catch {
    return null
  }
}

async function buildHeader(clinic: AnamnesisDocClinic): Promise<Header> {
  // Bloco de texto da clínica, centralizado.
  const textParagraphs: Paragraph[] = []

  textParagraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: clinic.name, bold: true, size: 28, color: TEXT_HEX, font: FONT })],
      spacing: { after: 30 },
    }),
  )

  if (clinic.addressLine) {
    textParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: clinic.addressLine, size: 16, color: MUTED_HEX, font: FONT })],
        spacing: { after: 20 },
      }),
    )
  }

  if (clinic.contactLine) {
    textParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: clinic.contactLine, size: 16, color: MUTED_HEX, font: FONT })],
        spacing: { after: 20 },
      }),
    )
  }

  if (clinic.website) {
    textParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: clinic.website, size: 16, color: MUTED_HEX, font: FONT })],
        spacing: { after: 20 },
      }),
    )
  }

  const children: (Paragraph | Table)[] = []

  const logo = clinic.logoUrl ? await loadLogo(clinic.logoUrl) : null

  if (logo) {
    const box = computeLogoBox(logo.width, logo.height, LOGO_TARGET_HEIGHT_PX)
    // Logo à esquerda, texto centralizado: tabela de 2 colunas sem bordas.
    const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
    const cellBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }
    const logoCell = new TableCell({
      width: { size: 25, type: WidthType.PERCENTAGE },
      borders: cellBorders,
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          children: [
            new ImageRun({ data: logo.bytes, transformation: { width: box.width, height: box.height }, type: logo.type }),
          ],
        }),
      ],
    })
    const textCell = new TableCell({
      width: { size: 75, type: WidthType.PERCENTAGE },
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

function buildFooter(footer: AnamnesisDocFooter | null): Footer {
  const children: Paragraph[] = []

  children.push(
    new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: RULE_HEX, space: 1 } },
      spacing: { after: 40 },
    }),
  )

  // Dados do profissional, centralizados.
  if (footer?.nameLine) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: footer.nameLine, size: 16, color: MUTED_HEX, font: FONT })],
        spacing: { after: 20 },
      }),
    )
  }

  if (footer?.crm) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: footer.crm, size: 16, color: MUTED_HEX, font: FONT })],
        spacing: { after: 60 },
      }),
    )
  }

  // Paginação
  children.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({ text: 'Página ', size: 14, color: MUTED_HEX, font: FONT }),
        new TextRun({ children: [PageNumber.CURRENT], size: 14, color: MUTED_HEX, font: FONT }),
        new TextRun({ text: ' de ', size: 14, color: MUTED_HEX, font: FONT }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: MUTED_HEX, font: FONT }),
      ],
    }),
  )

  return new Footer({ children })
}

function buildMetaBlock(title: string, lines: AnamnesisDocLine[]): Paragraph[] {
  const out: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: title.toUpperCase(), size: 16, color: TEXT_HEX, bold: true, font: FONT })],
      spacing: { after: 80 },
    }),
  ]
  for (const { label, value } of lines) {
    out.push(
      new Paragraph({
        children: [new TextRun({ text: `${label}: ${value}`, size: 20, color: TEXT_HEX, font: FONT })],
        spacing: { after: 40 },
      }),
    )
  }
  return out
}

function buildBody(model: AnamnesisDocModel): (Paragraph | Table)[] {
  const children: (Paragraph | Table)[] = []

  // Título à esquerda + data à direita, na mesma linha (tabela invisível).
  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  const titleCellBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }
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
                  children: [new TextRun({ text: model.title, bold: true, size: 34, color: TEXT_HEX, font: FONT })],
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
                  children: [new TextRun({ text: model.dateLong, size: 18, color: MUTED_HEX, font: FONT })],
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
    ...buildMetaBlock('Paciente', model.patientLines),
  )

  // Separador entre meta e seções
  children.push(
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE_HEX, space: 1 } },
      spacing: { before: 200, after: 200 },
    }),
  )

  // Seções
  for (const s of model.sections) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: s.title.toUpperCase(), bold: true, size: 22, color: TEXT_HEX, font: FONT })],
        spacing: { before: 200, after: 120 },
      }),
      new Paragraph({
        children: [new TextRun({ text: s.content, size: 22, color: TEXT_HEX, font: FONT })],
        spacing: { after: 200 },
      }),
    )
  }

  return children
}

export async function generateDOCXBlob({
  patient,
  consultation,
  doctorName,
  doctorCRM,
  doctorSpecialty,
  clinic,
}: DOCXProps): Promise<Blob> {
  const model = buildAnamnesisDocModel({
    patient,
    professional: { name: doctorName, specialty: doctorSpecialty, crm: doctorCRM },
    clinic,
    structuredAnamnesis: consultation.structuredAnamnesis,
    updatedAt: consultation.updatedAt,
  })

  const header = model.clinic ? await buildHeader(model.clinic) : undefined
  const footer = model.professionalFooter ? buildFooter(model.professionalFooter) : undefined

  const doc = new Document({
    sections: [{
      headers: header ? { default: header } : undefined,
      footers: footer ? { default: footer } : undefined,
      properties: {
        page: { margin: { top: 1100, right: 1300, bottom: 1100, left: 1300 } },
      },
      children: buildBody(model),
    }],
  })

  const buffer = await Packer.toBuffer(doc)
  return new Blob([new Uint8Array(buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}
