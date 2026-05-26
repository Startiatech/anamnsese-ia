// src/components/steps/StepAnamnesis.tsx
'use client'
import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AppAlertDialog } from '@/components/ui/app-alert-dialog'
import { useConsultationFlow } from '@/context/consultation-context'
import { useConsultation } from '@/hooks/use-consultation'
import { API } from '@/lib/routes'
import type { Section } from '@/types'

interface StepAnamnesisProps {
  patientId: string
  onComplete: () => void
  refinementAttemptsUsed: number
}

export function StepAnamnesis({
  patientId,
  onComplete,
  refinementAttemptsUsed,
}: StepAnamnesisProps) {
  const { state, setStructuredAnamnesis, professional, clinic, refinementAttemptsLimit } = useConsultationFlow()
  const { saveConsultation } = useConsultation(patientId)
  const patient = state.patient
  const [sections, setSections] = useState<Section[]>(state.structuredAnamnesis?.sections ?? [])
  const [saving, setSaving] = useState(false)
  const [exportedPdf, setExportedPdf] = useState(false)
  const [exportedDocx, setExportedDocx] = useState(false)
  const [copiedClipboard, setCopiedClipboard] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [refinementUsed, setRefinementUsed] = useState(refinementAttemptsUsed)
  const [refineBlock, setRefineBlock] = useState('__all__')
  const [refineInstruction, setRefineInstruction] = useState('')
  const [refining, setRefining] = useState(false)

  const doSave = useCallback(async () => {
    setSaving(true)
    const updated = { sections }
    setStructuredAnamnesis(updated)
    const promise = saveConsultation(state.rawTranscript, updated)
    toast.promise(promise, {
      loading: 'Aguarde...',
      success: 'Atendimento finalizado.',
      error: (err: Error) => err.message || 'Erro ao salvar. Tente novamente.',
    })
    try {
      await promise
      onComplete()
    } catch {
      setSaving(false)
    }
  }, [sections, state.rawTranscript, setStructuredAnamnesis, saveConsultation, onComplete])

  const handleFinalize = useCallback(() => {
    setConfirmOpen(true)
  }, [])

  function updateSection(index: number, content: string) {
    setSections(prev => prev.map((s, i) => i === index ? { ...s, content } : s))
  }

  async function handleRefine() {
    if (!refineInstruction.trim()) return
    setRefining(true)
    // Optimistic increment: server charges the quota on every non-429 path.
    // UI must reflect that immediately so the user sees the correct consumed count
    // even when the AI call fails after the quota was already debited.
    setRefinementUsed(prev => prev + 1)
    const instruction =
      refineBlock === '__all__'
        ? refineInstruction.trim()
        : `[Bloco: "${refineBlock}"] ${refineInstruction.trim()}`
    const promise = fetch(API.anamnesisRefine, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sections, instruction, patientId }),
    }).then(async res => {
      if (res.status === 429) throw new Error('Limite de refinamentos atingido para este plano.')
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Erro ao refinar.')
      }
      return res.json() as Promise<{ sections: Section[]; refinementCount: number }>
    })
    toast.promise(promise, {
      loading: 'Aguarde...',
      success: 'Anamnese refinada com sucesso.',
      error: (err: Error) => err.message,
    })
    const result = await promise.catch((err: Error) => {
      // 429 means the RPC rejected before incrementing — rollback the optimistic count
      if (err.message.includes('Limite de refinamentos')) {
        setRefinementUsed(prev => prev - 1)
      }
      return null
    })
    if (result) {
      setSections(result.sections)
      setRefinementUsed(result.refinementCount)
      setRefineInstruction('')
      setRefineBlock('__all__')
    }
    setRefining(false)
  }

  function handleCopy() {
    const today = new Date().toLocaleDateString('pt-BR')
    const lines: string[] = []

    lines.push('ANAMNESE CLÍNICA')
    lines.push(`Data: ${today}`)
    lines.push('')

    lines.push('PROFISSIONAL')
    if (professional.name) lines.push(`Nome: ${professional.name}`)
    if (professional.specialty) lines.push(`Especialidade: ${professional.specialty}`)
    if (professional.crm) lines.push(`CRM: ${professional.crm}`)
    lines.push('')

    lines.push('PACIENTE')
    if (patient?.name) lines.push(`Nome: ${patient.name}`)
    if (patient?.cpf) lines.push(`CPF: ${patient.cpf}`)
    if (patient?.birthDate) {
      const [yyyy, mm, dd] = patient.birthDate.split('-')
      lines.push(`Data de nascimento: ${dd}/${mm}/${yyyy}`)
    }
    if (patient?.phone) lines.push(`Telefone: ${patient.phone}`)
    lines.push('')
    lines.push('─'.repeat(40))
    lines.push('')

    sections.forEach(s => {
      lines.push(s.title)
      lines.push(s.content)
      lines.push('')
    })

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      toast.success('Copiado para a área de transferência.')
      setCopiedClipboard(true)
    })
  }

  function buildConsultationShape() {
    return {
      id: 'preview',
      patientId: patient?.id ?? '',
      rawTranscript: state.rawTranscript,
      structuredAnamnesis: { sections },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  function safeFilename(name: string): string {
    return name.replace(/\s+/g, '-').toLowerCase() || 'anamnese'
  }

  async function handlePrint() {
    if (!patient) return
    const { generatePDFBlob } = await import('@/lib/pdf')
    const blob = await generatePDFBlob({
      patient,
      consultation: buildConsultationShape(),
      doctorName: professional.name,
      doctorCRM: professional.crm,
      doctorSpecialty: professional.specialty,
      clinic,
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `anamnese-${safeFilename(patient.name)}.pdf`
    a.click()
    URL.revokeObjectURL(url)
    setExportedPdf(true)
  }

  async function handleDocx() {
    if (!patient) return
    const { generateDOCXBlob } = await import('@/lib/docx')
    const blob = await generateDOCXBlob({
      patient,
      consultation: buildConsultationShape(),
      doctorName: professional.name,
      doctorCRM: professional.crm,
      doctorSpecialty: professional.specialty,
      clinic,
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `anamnese-${safeFilename(patient.name)}.docx`
    a.click()
    URL.revokeObjectURL(url)
    setExportedDocx(true)
  }

  const refinementLimitReached =
    refinementAttemptsLimit !== null && refinementUsed >= refinementAttemptsLimit

  const refinementLabel =
    refinementAttemptsLimit !== null
      ? `${refinementUsed}/${refinementAttemptsLimit} refinamentos usados`
      : `${refinementUsed} refinamento${refinementUsed === 1 ? '' : 's'} realizado${refinementUsed === 1 ? '' : 's'}`

  return (
    <>
    <AppAlertDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      logoId="finalize-modal"
      title="Finalizar atendimento"
      description="Esta anamnese ficará disponível no histórico do paciente, onde você poderá exportar PDF, DOCX ou copiar o texto a qualquer momento."
      cancelLabel="Cancelar"
      actionLabel="Finalizar"
      onConfirm={() => { setConfirmOpen(false); void doSave() }}
    />

    <div className="flex flex-col md:flex-row md:gap-6 md:items-start">

      {/* Coluna esquerda — seções editáveis */}
      <div className="flex-1 min-w-0 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Anamnese Estruturada</h2>
          <p className="text-sm text-muted-foreground">Revise e edite as seções antes de finalizar.</p>
        </div>

        {sections.map((section, idx) => (
          <Card key={section.title}>
            <CardContent className="pt-4 space-y-1">
              <Label>{section.title}</Label>
              <Textarea
                value={section.content}
                onChange={e => updateSection(idx, e.target.value)}
                rows={4}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Coluna direita — painel de ações (sticky) */}
      <div className="w-full md:w-72 shrink-0 space-y-4 mt-6 md:mt-0 md:sticky md:top-4">

        {/* Exportar */}
        <div className="border border-border rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium">Exportar anamnese</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="rounded-lg" onClick={handlePrint} disabled={saving}>
              {exportedPdf ? '✓ PDF exportado' : 'Exportar PDF'}
            </Button>
            <Button variant="outline" size="sm" className="rounded-lg" onClick={handleDocx} disabled={saving}>
              {exportedDocx ? '✓ DOCX exportado' : 'Exportar DOCX'}
            </Button>
            <Button variant="outline" size="sm" className="rounded-lg" onClick={handleCopy} disabled={saving}>
              {copiedClipboard ? '✓ Copiado' : 'Copiar texto'}
            </Button>
          </div>
        </div>

        {/* Cota de refinamentos */}
        <div className="rounded-xl border border-primary/15 p-4 space-y-3 bg-primary/[0.04]">
          <p className="text-xs font-bold uppercase tracking-widest text-highlight">Cota de refinamentos</p>
          {refinementAttemptsLimit !== null ? (
            <>
              <div className="flex items-end gap-1">
                <span className="text-2xl font-bold text-foreground">{refinementUsed}</span>
                <span className="text-sm text-muted-foreground mb-0.5">/ {refinementAttemptsLimit} usados</span>
              </div>
              <div className="w-full rounded-full h-1.5 bg-white/10">
                <div
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (refinementUsed / refinementAttemptsLimit) * 100)}%`,
                    background: refinementLimitReached
                      ? 'rgb(239,68,68)'
                      : 'var(--gradient-brand)',
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {refinementLimitReached
                  ? 'Limite atingido. Faça upgrade do plano.'
                  : `${refinementAttemptsLimit - refinementUsed} refinamento${refinementAttemptsLimit - refinementUsed !== 1 ? 's' : ''} restante${refinementAttemptsLimit - refinementUsed !== 1 ? 's' : ''}`}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Refinamentos ilimitados no seu plano.</p>
          )}
        </div>

        {/* Refinar com IA */}
        <div className="border border-border rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium">Refinar com IA</p>
          <div className="space-y-1">
            <Label htmlFor="refine-block-select" className="text-xs text-muted-foreground">Bloco</Label>
            <Select
              value={refineBlock}
              onValueChange={setRefineBlock}
              disabled={refinementLimitReached || refining || saving}
            >
              <SelectTrigger id="refine-block-select" className="w-full rounded-lg" aria-label="Bloco">
                <SelectValue placeholder="Selecionar bloco" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Anamnese completa</SelectItem>
                {sections.map(s => (
                  <SelectItem key={s.title} value={s.title}>{s.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea
            placeholder="O que ajustar neste bloco?"
            value={refineInstruction}
            onChange={e => setRefineInstruction(e.target.value)}
            rows={3}
            disabled={refinementLimitReached || refining || saving}
          />
          <Button
            variant="secondary"
            size="sm"
            className="rounded-lg w-full"
            onClick={handleRefine}
            disabled={!refineInstruction.trim() || refinementLimitReached || refining || saving}
          >
            {refining ? 'Aguarde...' : 'Refinar'}
          </Button>
        </div>

        {/* Finalizar */}
        {saving && (
          <p className="text-sm text-muted-foreground text-center">Salvando consulta...</p>
        )}
        <Button
          size="lg"
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={handleFinalize}
          disabled={saving}
        >
          {saving ? 'Aguarde...' : 'Finalizar Atendimento'}
        </Button>
      </div>

    </div>
    </>
  )
}
