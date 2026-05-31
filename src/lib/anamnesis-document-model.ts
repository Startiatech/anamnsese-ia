import type { Patient, StructuredAnamnesis } from '@/types'
import type { ClinicData } from '@/lib/clinic'

// ─── Formatadores (fonte única de verdade para os 3 renderizadores) ──────────

const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

export function formatCnpj(raw: string): string {
  const d = (raw ?? '').replace(/\D/g, '')
  if (d.length !== 14) return raw ?? ''
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

export function formatCep(raw: string): string {
  const d = (raw ?? '').replace(/\D/g, '')
  if (d.length !== 8) return raw ?? ''
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

export function formatDateLong(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} de ${MONTHS_PT[d.getMonth()]} de ${d.getFullYear()}`
}

export function formatBirthDate(iso: string): string {
  const [yyyy, mm, dd] = iso.split('-')
  return `${dd}/${mm}/${yyyy}`
}

/**
 * Move a letra entre parênteses do fim para o início do título da seção:
 * "Subjetivo (S)" → "(S) Subjetivo". Títulos sem parênteses passam intactos.
 */
export function formatSectionTitle(title: string): string {
  const m = title.match(/^(.*?)\s*\(([^)]+)\)\s*$/)
  return m ? `(${m[2]}) ${m[1]}` : title
}

/**
 * Calcula as dimensões da logo preservando a proporção real da imagem,
 * a partir de uma altura-alvo. Evita o "quadrado que espreme" logos largas.
 * Se as dimensões naturais forem inválidas, cai para um quadrado da altura-alvo.
 */
export function computeLogoBox(
  naturalWidth: number,
  naturalHeight: number,
  targetHeight: number,
): { width: number; height: number } {
  if (!naturalWidth || !naturalHeight || naturalHeight <= 0) {
    return { width: targetHeight, height: targetHeight }
  }
  const ratio = naturalWidth / naturalHeight
  return { width: Math.round(targetHeight * ratio), height: targetHeight }
}

// ─── Modelo do documento ─────────────────────────────────────────────────────

export interface AnamnesisDocClinic {
  name: string
  logoUrl: string | null
  addressLine: string
  contactLine: string
  website: string | null
}

export interface AnamnesisDocLine {
  label: string
  value: string
}

export interface AnamnesisDocFooter {
  nameLine: string
  crm: string
}

export interface AnamnesisDocModel {
  clinic: AnamnesisDocClinic | null
  title: string
  dateLong: string
  patientLines: AnamnesisDocLine[]
  sections: { title: string; content: string }[]
  professionalFooter: AnamnesisDocFooter | null
}

export interface BuildAnamnesisDocModelInput {
  patient: Patient
  professional: { name: string; specialty: string; crm: string }
  clinic?: ClinicData
  structuredAnamnesis: StructuredAnamnesis
  updatedAt: string
}

export const ANAMNESIS_DOC_TITLE = 'ANAMNESE CLÍNICA'

/**
 * Normaliza todos os dados do documento de anamnese num modelo único, consumido
 * de forma idêntica pelos renderizadores de tela, DOCX e PDF. Centralizar aqui
 * elimina os múltiplos pontos de mudança: campos, ordem, formatação e textos
 * vivem só neste arquivo.
 */
export function buildAnamnesisDocModel({
  patient,
  professional,
  clinic,
  structuredAnamnesis,
  updatedAt,
}: BuildAnamnesisDocModelInput): AnamnesisDocModel {
  const clinicModel: AnamnesisDocClinic | null = clinic?.clinicName
    ? {
        name: clinic.clinicName,
        logoUrl: clinic.clinicLogoUrl || null,
        addressLine: clinic.clinicAddress
          ? `${clinic.clinicAddress}${clinic.clinicAddressNumber ? `, ${clinic.clinicAddressNumber}` : ''} · CEP ${formatCep(clinic.clinicCep)}`
          : '',
        contactLine: [
          clinic.clinicCnpj && `CNPJ ${formatCnpj(clinic.clinicCnpj)}`,
          clinic.clinicPhone,
          clinic.clinicEmail,
        ].filter(Boolean).join('  ·  '),
        website: clinic.clinicWebsite || null,
      }
    : null

  const patientLines: AnamnesisDocLine[] = [
    { label: 'Nome', value: patient.name },
    { label: 'CPF', value: patient.cpf ?? '' },
    { label: 'Nascimento', value: patient.birthDate ? formatBirthDate(patient.birthDate) : '' },
    { label: 'Telefone', value: patient.phone ?? '' },
  ].filter((l) => l.value)

  const sections = structuredAnamnesis.sections.map((s) => ({
    title: formatSectionTitle(s.title),
    content: s.content,
  }))

  const nameLine = [professional.name, professional.specialty].filter(Boolean).join(' — ')
  const professionalFooter: AnamnesisDocFooter | null = nameLine
    ? { nameLine, crm: professional.crm }
    : null

  return {
    clinic: clinicModel,
    title: ANAMNESIS_DOC_TITLE,
    dateLong: formatDateLong(updatedAt),
    patientLines,
    sections,
    professionalFooter,
  }
}
