// src/components/steps/StepSections.tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useConsultationFlow } from '@/context/consultation-context'
import { DEFAULT_SOAP_SECTIONS } from '@/types'
import { toast } from 'sonner'

export function StepSections() {
  const { state, nextStep, setSelectedSections, setStructuredAnamnesis } = useConsultationFlow()
  const [selected, setSelected] = useState<string[]>([...DEFAULT_SOAP_SECTIONS])
  const [extraInput, setExtraInput] = useState('')
  const [processing, setProcessing] = useState(false)

  function toggleSection(title: string) {
    setSelected(prev =>
      prev.includes(title) ? prev.filter(s => s !== title) : [...prev, title]
    )
  }

  function addExtra() {
    const trimmed = extraInput.trim()
    if (!trimmed || selected.includes(trimmed)) return
    setSelected(prev => [...prev, trimmed])
    setExtraInput('')
  }

  function removeSection(title: string) {
    setSelected(prev => prev.filter(s => s !== title))
  }

  function handleGenerate() {
    if (selected.length === 0) { toast.error('Selecione ao menos uma seção.'); return }
    setProcessing(true)
    toast.promise(
      fetch('/api/anamnesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: state.rawTranscript, sections: selected }),
      }).then(async (res) => {
        const data = await res.json() as { sections?: unknown; error?: string }
        if (!res.ok) throw new Error(data.error ?? 'Erro ao gerar anamnese')
        if (!Array.isArray(data.sections)) throw new Error('Resposta inválida da IA. Tente novamente.')
        setSelectedSections(selected)
        setStructuredAnamnesis(data as { sections: { title: string; content: string }[] })
        nextStep()
      }).finally(() => setProcessing(false)),
      { loading: 'Aguarde...', success: 'Anamnese gerada!', error: (err: Error) => err.message || 'Erro inesperado.' }
    )
  }

  const soapNotSelected = [...DEFAULT_SOAP_SECTIONS].filter(s => !selected.includes(s))

  return (
    <div className="flex flex-col md:flex-row md:gap-8 md:items-start">
      {/* Coluna principal — transcrição capturada */}
      <div className="flex-1 min-w-0 space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Revisão e Seleção de Seções</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Revise a transcrição e escolha as seções para a anamnese.</p>
        </div>
        <div className="rounded-xl border border-primary/15 p-5 space-y-3 h-full bg-primary/[0.04]">
          <p className="text-xs font-bold uppercase tracking-widest text-highlight">Transcrição capturada</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap overflow-y-auto leading-relaxed" style={{ maxHeight: '28rem' }}>
            {state.rawTranscript || <span className="italic">Nenhuma transcrição disponível.</span>}
          </p>
        </div>
      </div>

      {/* Painel direito — seleção de seções + gerar */}
      <div className="w-full md:w-72 shrink-0 space-y-5 mt-6 md:mt-0 md:sticky md:top-4">
        <div className="rounded-xl border border-border p-5 space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Seções da anamnese</p>

          <div className="flex flex-wrap gap-2">
            {selected.map(section => (
              <div key={section} className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1">
                <span className="text-sm text-primary">{section}</span>
                <Button variant="ghost" size="icon" onClick={() => removeSection(section)} className="h-4 w-4 ml-1 text-primary/50 hover:text-primary">✕</Button>
              </div>
            ))}
          </div>

          {soapNotSelected.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {soapNotSelected.map(s => (
                <Button
                  key={s}
                  variant="outline"
                  size="sm"
                  onClick={() => toggleSection(s)}
                  className="rounded-full"
                >
                  + {s}
                </Button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Input
              name="custom-section"
              autoComplete="off"
              placeholder="Seção personalizada..."
              value={extraInput}
              onChange={e => setExtraInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addExtra()}
            />
            <Button variant="outline" onClick={addExtra} disabled={!extraInput.trim()}>+</Button>
          </div>
        </div>

        <Button className="w-full" size="lg" onClick={handleGenerate} disabled={selected.length === 0 || processing}>
          {processing ? 'Aguarde...' : 'Gerar Anamnese'}
        </Button>
      </div>
    </div>
  )
}
