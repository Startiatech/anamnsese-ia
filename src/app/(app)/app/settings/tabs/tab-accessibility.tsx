'use client'

import { Type, Contrast, AlignJustify, Focus, Wind, Check, AlertTriangle, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useAccessibility, type FontSize, type SaveStatus } from '@/context/accessibility-context'
import { RequestFeedbackCard } from './request-feedback-card'

const FONT_OPTIONS: { value: FontSize; label: string; description: string }[] = [
  { value: 'normal', label: 'Normal',       description: 'Tamanho padrão (16px)' },
  { value: 'large',  label: 'Grande',       description: '12,5% maior (~18px)' },
  { value: 'xlarge', label: 'Extra grande', description: '25% maior (~20px)' },
]

interface SectionCardProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  children: React.ReactNode
}

function SectionCard({ icon: Icon, title, description, children }: SectionCardProps) {
  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <div className="flex gap-4 mb-5">
          <div className="shrink-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 border border-primary/20">
              <Icon className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div className="flex-1 space-y-1 pt-1">
            <p className="text-sm font-semibold text-foreground uppercase tracking-wide">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

interface ToggleSwitchProps {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}

function ToggleSwitch({ label, checked, onChange }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        checked ? 'bg-primary' : 'bg-muted'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

function StickyStatusIndicator({ status }: { status: SaveStatus }) {
  // Reserva sempre um slot fixo para evitar layout shift quando status some/aparece.
  // Sticky para acompanhar o scroll da pagina dentro de Configuracoes.
  return (
    <div className="sticky top-2 z-10 -mx-1 px-1">
      <div className="h-7 flex items-center">
        {status === 'saving' && (
          <span
            role="status"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card border border-border text-xs text-muted-foreground shadow-sm"
          >
            <Loader2 className="h-3 w-3 animate-spin" />
            Salvando...
          </span>
        )}
        {status === 'saved' && (
          <span
            role="status"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-600 dark:text-emerald-400 shadow-sm"
          >
            <Check className="h-3 w-3" />
            Salvo
          </span>
        )}
        {status === 'error' && (
          <span
            role="status"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10 border border-destructive/40 text-xs text-destructive shadow-sm"
          >
            <AlertTriangle className="h-3 w-3" />
            Não foi possível salvar — verifique sua conexão.
          </span>
        )}
      </div>
    </div>
  )
}

export function TabAccessibility({ showRequestCard = true }: { showRequestCard?: boolean } = {}) {
  const {
    fontSize, highContrast, spacingIncreased, focusHighlight, extraReducedMotion,
    saveStatus,
    setFontSize, setHighContrast, setSpacingIncreased, setFocusHighlight, setExtraReducedMotion,
  } = useAccessibility()

  return (
    <div className="space-y-4">
      <StickyStatusIndicator status={saveStatus} />

      <SectionCard
        icon={Type}
        title="Tamanho da fonte"
        description="Ajusta proporcionalmente todos os textos da plataforma."
      >
        <div role="radiogroup" aria-label="Tamanho da fonte" className="grid gap-2 sm:grid-cols-3">
          {FONT_OPTIONS.map((opt) => {
            const active = fontSize === opt.value
            return (
              <label
                key={opt.value}
                className={`relative cursor-pointer rounded-lg border p-4 transition-colors ${
                  active
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <input
                  type="radio"
                  name="a11y-font-size"
                  value={opt.value}
                  checked={active}
                  onChange={() => setFontSize(opt.value)}
                  className="sr-only"
                  aria-label={opt.label}
                />
                <span className="block text-sm font-medium text-foreground">{opt.label}</span>
                <span className="block text-xs text-muted-foreground mt-1">{opt.description}</span>
              </label>
            )
          })}
        </div>
      </SectionCard>

      <SectionCard
        icon={Contrast}
        title="Alto contraste"
        description="Aumenta o contraste entre texto, fundo e bordas para melhor legibilidade."
      >
        <ToggleSwitch label="Alto contraste" checked={highContrast} onChange={setHighContrast} />
      </SectionCard>

      <SectionCard
        icon={AlignJustify}
        title="Espaçamento de leitura"
        description="Aumenta espaço entre linhas, palavras e letras para reduzir fadiga visual."
      >
        <ToggleSwitch label="Espaçamento aumentado" checked={spacingIncreased} onChange={setSpacingIncreased} />
      </SectionCard>

      <SectionCard
        icon={Focus}
        title="Destacar elemento em foco"
        description="Realça com cor amarela e moldura espessa o elemento atualmente focado."
      >
        <ToggleSwitch label="Destacar foco atual" checked={focusHighlight} onChange={setFocusHighlight} />
      </SectionCard>

      <SectionCard
        icon={Wind}
        title="Reduzir movimento e animações"
        description="Desativa animações e transições da plataforma além das preferências do sistema."
      >
        <ToggleSwitch label="Reduzir movimento" checked={extraReducedMotion} onChange={setExtraReducedMotion} />
      </SectionCard>

      {showRequestCard && <RequestFeedbackCard />}
    </div>
  )
}
