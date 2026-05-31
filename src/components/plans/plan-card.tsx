'use client'

import { useState, useTransition } from 'react'
import { Check, Beaker, Briefcase, Star, Building2, Info } from 'lucide-react'
import { toast } from 'sonner'
import { selectPlanAction } from '@/server/actions/plans'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AppSheet } from '@/components/ui/app-sheet'
import type { Plan } from '@/server/repositories/plans'

const PLAN_ICONS: Record<string, React.ElementType> = {
  experimental:        Beaker,
  profissional:        Briefcase,
  'profissional-premium': Star,
  'clinica-gestao':    Building2,
}

const PLAN_COLORS: Record<string, { icon: string; iconBg: string; badge: string }> = {
  experimental: {
    icon:   'text-cyan-700 dark:text-cyan-400',
    iconBg: 'bg-cyan-500/10 border-cyan-500/25',
    badge:  'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20',
  },
  profissional: {
    icon:   'text-violet-600 dark:text-violet-400',
    iconBg: 'bg-violet-500/10 border-violet-500/25',
    badge:  'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  },
  'profissional-premium': {
    icon:   'text-amber-600 dark:text-amber-400',
    iconBg: 'bg-amber-500/10 border-amber-500/25',
    badge:  'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  'clinica-gestao': {
    icon:   'text-emerald-600 dark:text-emerald-400',
    iconBg: 'bg-emerald-500/10 border-emerald-500/25',
    badge:  'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
}

interface PlanCardProps {
  plan: Plan
  isCurrent: boolean
}

export function PlanCard({ plan, isCurrent }: PlanCardProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSelect() {
    startTransition(() => {
      toast.promise(selectPlanAction(plan.id), {
        loading: 'Aguarde...',
        success: `Plano ${plan.name} selecionado!`,
        error: 'Erro ao selecionar plano.',
      })
    })
  }

  const Icon = PLAN_ICONS[plan.id] ?? Briefcase
  const colors = PLAN_COLORS[plan.id] ?? PLAN_COLORS['profissional']
  const activeFeatures = plan.features.filter((f) => f.active)
  const previewFeatures = activeFeatures.slice(0, 6)

  return (
    <>
      <Card className={isCurrent ? 'border-primary/40 ring-1 ring-primary/20' : ''}>
        <CardContent className="p-4 sm:p-5">
          {/* Layout horizontal */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">

            {/* Coluna 1 — Ícone + nome + preço */}
            <div className="flex items-center gap-3 sm:w-44 shrink-0">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${colors.iconBg}`}>
                <Icon className={`h-5 w-5 ${colors.icon}`} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground leading-tight">{plan.name}</p>
                  {isCurrent && (
                    <Badge className={`text-[10px] px-1.5 py-0 ${colors.badge}`}>Plano atual</Badge>
                  )}
                </div>
                <div className="flex items-baseline gap-0.5 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">R$</span>
                  <span className="text-lg font-bold text-foreground leading-none">{plan.price === 0 ? '0' : plan.price}</span>
                  <span className="text-[10px] text-muted-foreground">/mês</span>
                </div>
              </div>
            </div>

            {/* Coluna 2 — Features chips */}
            <div className="flex-1 flex flex-wrap gap-1.5">
              {previewFeatures.map((f) => (
                <span
                  key={f.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border bg-muted/40 text-xs text-muted-foreground"
                >
                  <Check className={`h-2.5 w-2.5 shrink-0 ${colors.icon}`} />
                  <span className="truncate max-w-[140px]">{f.label}</span>
                </span>
              ))}
              {activeFeatures.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSheetOpen(true)}
                  className="h-auto px-2 py-0.5 rounded-full border border-dashed border-border text-xs gap-1"
                >
                  <Info className="h-2.5 w-2.5 shrink-0" />
                  Visualizar recursos detalhados
                </Button>
              )}
            </div>

            {/* Coluna 3 — CTA */}
            <div className="shrink-0 sm:w-36">
              <Button
                variant={isCurrent ? 'outline' : 'default'}
                disabled={isCurrent || isPending}
                onClick={isCurrent ? undefined : handleSelect}
                className={`w-full ${isCurrent ? 'border-primary/30 text-primary cursor-default' : 'shadow-[0_0_12px_var(--glow-brand)]'}`}
              >
                {isCurrent ? '✓ Plano selecionado' : isPending ? 'Aguarde...' : '+ Selecionar plano'}
              </Button>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Sheet de recursos detalhados */}
      <AppSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={plan.name}
        description="Lista completa de recursos do plano"
        icon={<Icon className={`h-4 w-4 ${colors.icon}`} />}
        hideFooter
      >
        <div className="space-y-2">
          {activeFeatures.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
            >
              <Check className={`h-4 w-4 shrink-0 ${colors.icon}`} />
              <span className="text-sm text-foreground">{f.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-border">
          <Button
            variant={isCurrent ? 'outline' : 'default'}
            size="lg"
            disabled={isCurrent || isPending}
            onClick={isCurrent ? undefined : handleSelect}
            className={`w-full ${isCurrent ? 'border-primary/30 text-primary cursor-default' : ''}`}
          >
            {isCurrent ? '✓ Plano selecionado' : isPending ? 'Aguarde...' : '+ Selecionar este plano'}
          </Button>
        </div>
      </AppSheet>
    </>
  )
}
