'use client'

import { useState } from 'react'
import { Type, Contrast, AlignJustify, Focus, Wind, Check, AlertTriangle, Loader2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { IconBadge } from '@/components/ui/icon-badge'
import { useAccessibility, type FontSize, type SaveStatus } from '@/context/accessibility-context'
import { RequestFeedbackCard } from './request-feedback-card'

const FONT_OPTIONS: { value: FontSize; label: string; description: string }[] = [
  { value: 'normal', label: 'Normal',       description: 'Tamanho padrão (16px)' },
  { value: 'large',  label: 'Grande',       description: '12,5% maior (~18px)' },
  { value: 'xlarge', label: 'Extra grande', description: '25% maior (~20px)' },
]

interface SectionCardProps {
  icon: LucideIcon
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
            <IconBadge icon={Icon} />
          </div>
          <div className="flex-1 min-w-0 space-y-1 pt-1">
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
      // before: amplia a area tocavel vertical para ~40px (24px do trilho +
      // 8px acima/abaixo) sem alterar o visual do switch — alvo de toque mobile.
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
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

// Slot de status com altura reservada (h-7) — evita layout shift quando o chip
// aparece/some. Chip alinhado a direita; vazio quando idle. Em `wrap` (colunas
// estreitas do grid de fonte) usa `min-h-7` para permitir que o chip de erro
// quebre em 2 linhas sem ser cortado.
function StatusSlot({ status, wrap = false }: { status: SaveStatus; wrap?: boolean }) {
  return (
    <div className={`flex justify-end ${wrap ? 'min-h-7 items-start' : 'h-7 items-center'}`}>
      <StatusChip status={status} wrap={wrap} />
    </div>
  )
}

// Linha de controle dos toggles: switch a esquerda, slot de status a direita,
// na mesma linha (mesma direcao do switch). Espaco reservado em ambos os lados.
function ToggleRow({ label, checked, onChange, status }: ToggleSwitchProps & { status: SaveStatus }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <ToggleSwitch label={label} checked={checked} onChange={onChange} />
      <StatusSlot status={status} />
    </div>
  )
}

// Chip de status exibido inline no cabecalho do card que disparou o save —
// fica sempre proximo do controle que o usuario acabou de alterar, em qualquer
// posicao de scroll. Quando ocioso, nao renderiza nada (zero footprint, mesmo
// espacamento das demais tabs). Texto compacto para caber no mobile (375px).
function StatusChip({ status, wrap = false }: { status: SaveStatus; wrap?: boolean }) {
  // Em `wrap` (colunas estreitas do grid de fonte) o chip pode quebrar linha
  // — rounded-lg + whitespace-normal evitam corte/overflow. Caso contrario,
  // pilula compacta de uma linha (rounded-full + nowrap).
  const shape = wrap
    ? 'rounded-lg whitespace-normal leading-tight text-left'
    : 'rounded-full whitespace-nowrap'
  const base = `inline-flex items-center gap-1.5 px-2.5 py-1 border text-xs shadow-sm ${shape}`

  if (status === 'saving') {
    return (
      <span role="status" className={`${base} bg-card border-border text-muted-foreground`}>
        <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
        Salvando...
      </span>
    )
  }
  if (status === 'saved') {
    return (
      <span role="status" className={`${base} bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400`}>
        <Check className="h-3 w-3 shrink-0" />
        Salvo
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span role="status" className={`${base} bg-destructive/10 border-destructive/40 text-destructive`}>
        <AlertTriangle className="h-3 w-3 shrink-0" />
        Não foi possível salvar.
      </span>
    )
  }
  return null
}

type CardId = 'font' | 'contrast' | 'spacing' | 'focus' | 'motion'

export function TabAccessibility({ showRequestCard = true }: { showRequestCard?: boolean } = {}) {
  const {
    fontSize, highContrast, spacingIncreased, focusHighlight, extraReducedMotion,
    saveStatus,
    setFontSize, setHighContrast, setSpacingIncreased, setFocusHighlight, setExtraReducedMotion,
  } = useAccessibility()

  // Card que disparou o ultimo save — so ele exibe o chip de status, garantindo
  // que o feedback apareca junto do controle que o usuario acabou de mexer.
  const [activeCard, setActiveCard] = useState<CardId | null>(null)

  // Helper: marca o card como ativo e aplica a mudanca. Tipado para preservar
  // o tipo do valor de cada setter.
  function withCard<T>(card: CardId, apply: (value: T) => void) {
    return (value: T) => {
      setActiveCard(card)
      apply(value)
    }
  }

  // Mostra o chip apenas no card ativo. Idle = null (sem footprint).
  const statusFor = (card: CardId): SaveStatus => (activeCard === card ? saveStatus : 'idle')

  return (
    <div className="space-y-4">
      <SectionCard
        icon={Type}
        title="Tamanho da fonte"
        description="Ajusta proporcionalmente todos os textos da plataforma."
      >
        <div role="radiogroup" aria-label="Tamanho da fonte" className="grid gap-2 sm:grid-cols-3">
          {FONT_OPTIONS.map((opt) => {
            const active = fontSize === opt.value
            // Status por bloco: so a opcao selecionada do card de fonte exibe o chip.
            const optStatus: SaveStatus = activeCard === 'font' && active ? saveStatus : 'idle'
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
                  onChange={withCard('font', () => setFontSize(opt.value))}
                  className="sr-only"
                  aria-label={opt.label}
                />
                <span className="block text-sm font-medium text-foreground">{opt.label}</span>
                <span className="block text-xs text-muted-foreground mt-1">{opt.description}</span>
                {/* Slot reservado em todas as opcoes -> alturas iguais, sem pulo.
                    wrap: colunas estreitas (sm:grid-cols-3) permitem o chip de
                    erro quebrar em 2 linhas sem cortar. */}
                <StatusSlot status={optStatus} wrap />
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
        <ToggleRow label="Alto contraste" checked={highContrast} onChange={withCard('contrast', setHighContrast)} status={statusFor('contrast')} />
      </SectionCard>

      <SectionCard
        icon={AlignJustify}
        title="Espaçamento de leitura"
        description="Aumenta espaço entre linhas, palavras e letras para reduzir fadiga visual."
      >
        <ToggleRow label="Espaçamento aumentado" checked={spacingIncreased} onChange={withCard('spacing', setSpacingIncreased)} status={statusFor('spacing')} />
      </SectionCard>

      <SectionCard
        icon={Focus}
        title="Destacar elemento em foco"
        description="Realça com cor amarela e moldura espessa o elemento atualmente focado."
      >
        <ToggleRow label="Destacar foco atual" checked={focusHighlight} onChange={withCard('focus', setFocusHighlight)} status={statusFor('focus')} />
      </SectionCard>

      <SectionCard
        icon={Wind}
        title="Reduzir movimento e animações"
        description="Desativa animações e transições da plataforma além das preferências do sistema."
      >
        <ToggleRow label="Reduzir movimento" checked={extraReducedMotion} onChange={withCard('motion', setExtraReducedMotion)} status={statusFor('motion')} />
      </SectionCard>

      {showRequestCard && <RequestFeedbackCard />}
    </div>
  )
}
