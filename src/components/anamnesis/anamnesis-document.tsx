import type { Patient, StructuredAnamnesis } from '@/types'
import type { ClinicData } from '@/lib/clinic'
import {
  buildAnamnesisDocModel,
  type AnamnesisDocLine,
} from '@/lib/anamnesis-document-model'

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
  const model = buildAnamnesisDocModel({ patient, professional, clinic, structuredAnamnesis, updatedAt })

  return (
    // Fonte fixada em Times New Roman para a tela/PDF baterem exatamente com o DOCX.
    <div
      className="mx-auto w-full max-w-[210mm] bg-white text-neutral-900 shadow-2xl rounded-sm px-12 py-12 print:shadow-none print:rounded-none"
      style={{ fontFamily: '"Times New Roman", Times, serif' }}
    >
      {/* Cabeçalho institucional — dados centralizados, logo à esquerda */}
      {model.clinic && (
        <>
          <div className="relative">
            {model.clinic.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={model.clinic.logoUrl}
                alt="Logo da clínica"
                className="absolute left-0 top-0 h-[22mm] w-auto max-w-[60mm] object-contain"
              />
            )}
            <div className="text-center">
              <p className="font-bold text-[15pt] text-neutral-900 leading-snug">
                {model.clinic.name}
              </p>
              {model.clinic.addressLine && (
                <p className="text-[9pt] text-neutral-500 mt-1">{model.clinic.addressLine}</p>
              )}
              {model.clinic.contactLine && (
                <p className="text-[9pt] text-neutral-500">{model.clinic.contactLine}</p>
              )}
              {model.clinic.website && (
                <p className="text-[9pt] text-neutral-500">{model.clinic.website}</p>
              )}
            </div>
          </div>
          <div className="mt-4 border-t border-neutral-300" />
        </>
      )}

      {/* Título à esquerda + data à direita, na mesma linha */}
      <div className="mt-8 flex items-baseline justify-between gap-4">
        <h1 className="font-bold text-[17pt] text-neutral-900 tracking-wide">
          {model.title}
        </h1>
        <p className="shrink-0 text-[10pt] text-neutral-500">
          {model.dateLong}
        </p>
      </div>

      {/* Dados do paciente (profissional fica no rodapé) */}
      <div className="mt-6">
        <MetaBlock title="Paciente" lines={model.patientLines} />
      </div>

      <div className="mt-8 border-t border-neutral-300" />

      {/* Seções */}
      <div className="mt-6 space-y-6">
        {model.sections.map((section) => (
          <section key={section.title}>
            <h2 className="font-bold text-[10.5pt] text-neutral-900 uppercase tracking-wider">
              {section.title}
            </h2>
            <p className="mt-2 text-[11pt] leading-relaxed text-neutral-800 whitespace-pre-wrap">
              {section.content}
            </p>
          </section>
        ))}
      </div>

      {/* Rodapé — dados do profissional, centralizados */}
      {model.professionalFooter && (
        <footer className="mt-12 pt-4 border-t border-neutral-200 text-center text-[9pt] text-neutral-600 space-y-0.5">
          <p>{model.professionalFooter.nameLine}</p>
          {model.professionalFooter.crm && <p>{model.professionalFooter.crm}</p>}
        </footer>
      )}
    </div>
  )
}

function MetaBlock({ title, lines }: { title: string; lines: AnamnesisDocLine[] }) {
  return (
    <div>
      <p className="font-bold text-[9pt] text-neutral-900 uppercase tracking-wider">
        {title}
      </p>
      <div className="mt-2 space-y-1.5 text-[10.5pt] text-neutral-800">
        {lines.map(({ label, value }) => (
          <p key={label}>{label}: {value}</p>
        ))}
      </div>
    </div>
  )
}
