'use client'

import { Type, Contrast } from 'lucide-react'
import { useAccessibility, type FontSize } from '@/context/accessibility-context'

const FONT_OPTIONS: { value: FontSize; label: string; description: string }[] = [
  { value: 'normal', label: 'Normal',       description: 'Tamanho padrão (16px)' },
  { value: 'large',  label: 'Grande',       description: '12,5% maior (~18px)' },
  { value: 'xlarge', label: 'Extra grande', description: '25% maior (~20px)' },
]

export function TabAccessibility() {
  const { fontSize, highContrast, setFontSize, setHighContrast } = useAccessibility()

  return (
    <div className="space-y-8">
      {/* ── Tamanho da fonte ──────────────────────────────────────────────── */}
      <section aria-labelledby="a11y-font-size-heading">
        <div className="flex items-center gap-2 mb-1">
          <Type className="h-4 w-4 text-muted-foreground" />
          <h2 id="a11y-font-size-heading" className="text-sm font-medium text-foreground">
            Tamanho da fonte
          </h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Ajusta proporcionalmente todos os textos da plataforma.
        </p>

        <div role="radiogroup" aria-labelledby="a11y-font-size-heading" className="grid gap-2 sm:grid-cols-3">
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
      </section>

      {/* ── Alto contraste ────────────────────────────────────────────────── */}
      <section aria-labelledby="a11y-contrast-heading">
        <div className="flex items-center gap-2 mb-1">
          <Contrast className="h-4 w-4 text-muted-foreground" />
          <h2 id="a11y-contrast-heading" className="text-sm font-medium text-foreground">
            Alto contraste
          </h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Aumenta o contraste entre texto, fundo e bordas para melhor legibilidade.
        </p>

        <button
          type="button"
          role="switch"
          aria-checked={highContrast}
          aria-label="Alto contraste"
          onClick={() => setHighContrast(!highContrast)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
            highContrast ? 'bg-primary' : 'bg-muted'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              highContrast ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </section>

      <p className="text-xs text-muted-foreground">
        As preferências são salvas automaticamente e sincronizadas entre seus dispositivos.
      </p>
    </div>
  )
}
