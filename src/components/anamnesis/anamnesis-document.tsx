import type { Patient, StructuredAnamnesis } from '@/types'
import type { ClinicData } from '@/lib/clinic'

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

interface Professional {
  name: string
  specialty: string
  crm: string
}

interface AnamnesisDocumentProps {
  patient: Patient
  professional: Professional
  clinic?: ClinicData
  structuredAnamnesis: StructuredAnamnesis
  updatedAt: string
}

export function AnamnesisDocument({
  patient,
  professional,
  clinic,
  structuredAnamnesis,
  updatedAt,
}: AnamnesisDocumentProps) {
  const rtName = clinic?.clinicRtIsSelf ? professional.name : (clinic?.clinicRtName ?? '')
  const rtRegistry = clinic?.clinicRtIsSelf ? professional.crm : (clinic?.clinicRtRegistry ?? '')

  const profLines: { label: string; value: string }[] = [
    { label: 'Nome', value: professional.name },
    { label: 'Especialidade', value: professional.specialty },
    { label: 'Registro', value: professional.crm },
  ]
  const patLines: { label: string; value: string }[] = [
    { label: 'Nome', value: patient.name },
    { label: 'CPF', value: patient.cpf ?? '' },
    { label: 'Nascimento', value: patient.birthDate ? formatBirthDate(patient.birthDate) : '' },
    { label: 'Telefone', value: patient.phone ?? '' },
  ]

  return (
    <div className="mx-auto w-full max-w-[210mm] bg-white text-neutral-900 shadow-2xl rounded-sm px-12 py-12 print:shadow-none print:rounded-none">
      {/* Cabeçalho institucional */}
      {clinic?.clinicName && (
        <>
          <div className="flex items-start gap-5">
            {clinic.clinicLogoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={clinic.clinicLogoUrl}
                alt="Logo da clínica"
                className="h-16 w-16 object-contain shrink-0"
              />
            )}
            <div className="min-w-0">
              <p className="font-sans font-bold text-[15pt] text-neutral-900 leading-snug">
                {clinic.clinicName}
              </p>
              <p className="font-sans text-[9pt] text-neutral-500 mt-1">
                {[
                  clinic.clinicCnpj && `CNPJ ${formatCnpj(clinic.clinicCnpj)}`,
                  clinic.clinicPhone,
                  clinic.clinicEmail,
                ].filter(Boolean).join('  ·  ')}
              </p>
              {clinic.clinicWebsite && (
                <p className="font-sans text-[9pt] text-neutral-500">{clinic.clinicWebsite}</p>
              )}
            </div>
          </div>
          <div className="mt-4 border-t border-neutral-300" />
        </>
      )}

      {/* Título */}
      <h1 className="mt-8 text-center font-sans font-bold text-[17pt] text-neutral-900 tracking-wide">
        ANAMNESE CLÍNICA
      </h1>

      {/* Data */}
      <p className="mt-6 text-right font-sans text-[10pt] text-neutral-500">
        {formatDateLong(updatedAt)}
      </p>

      {/* Blocos Profissional / Paciente */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
        <MetaBlock title="Profissional" lines={profLines} />
        <MetaBlock title="Paciente" lines={patLines} />
      </div>

      <div className="mt-8 border-t border-neutral-300" />

      {/* Seções */}
      <div className="mt-6 space-y-6">
        {structuredAnamnesis.sections.map((section) => (
          <section key={section.title}>
            <h2 className="font-sans font-bold text-[10.5pt] text-neutral-900 uppercase tracking-wider">
              {section.title}
            </h2>
            <p className="mt-2 font-serif text-[11pt] leading-relaxed text-neutral-800 whitespace-pre-wrap">
              {section.content}
            </p>
          </section>
        ))}
      </div>

      {/* Rodapé */}
      {clinic?.clinicName && (
        <footer className="mt-12 pt-4 border-t border-neutral-200 text-center font-sans text-[8pt] text-neutral-500 space-y-1">
          <p>
            {clinic.clinicAddress}
            {clinic.clinicAddressNumber ? `, ${clinic.clinicAddressNumber}` : ''}
            {' · CEP '}
            {formatCep(clinic.clinicCep)}
          </p>
          {rtName && <p>Responsável Técnico: {rtName} — {rtRegistry}</p>}
          {clinic.clinicBusinessHours && <p>{clinic.clinicBusinessHours}</p>}
        </footer>
      )}
    </div>
  )
}

function MetaBlock({ title, lines }: { title: string; lines: { label: string; value: string }[] }) {
  return (
    <div>
      <p className="font-sans font-bold text-[9pt] text-neutral-900 uppercase tracking-wider">
        {title}
      </p>
      <div className="mt-2 space-y-1.5 font-serif text-[10.5pt] text-neutral-800">
        {lines.map(({ label, value }) =>
          value
            ? <p key={label}>{label}: {value}</p>
            : null
        )}
      </div>
    </div>
  )
}
