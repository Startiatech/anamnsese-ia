'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Star, Mail, MessageCircle, TrendingUp, TrendingDown, ArrowUpRight, MessageSquare, Loader2, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Empty, EmptyMedia, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty'
import { PageHeader } from '@/components/console/page-header'
import type { FeedbackWithUser, FeedbackMetrics } from '@/server/repositories/feedbacks'

interface FeedbacksClientProps {
  metrics: FeedbackMetrics
  feedbacks: FeedbackWithUser[]
}

const ACTION_BADGE: Record<string, { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' }> = {
  upgrade_modal:   { label: 'UPGRADE', variant: 'default' },
  upgrade_organic: { label: 'UPGRADE', variant: 'default' },
  declined:        { label: 'CANCELADO', variant: 'destructive' },
  pending:         { label: 'PENDENTE', variant: 'secondary' },
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          className="w-4 h-4"
          fill={n <= rating ? '#F59E0B' : 'transparent'}
          stroke={n <= rating ? '#F59E0B' : 'currentColor'}
        />
      ))}
    </div>
  )
}

export function FeedbacksClient({ metrics, feedbacks }: FeedbacksClientProps) {
  const router = useRouter()
  const [isRefreshing, setIsRefreshing] = useState(false)

  async function handleRefresh() {
    setIsRefreshing(true)
    router.refresh()
    await new Promise(r => setTimeout(r, 600))
    setIsRefreshing(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Feedback Intelligence" description="Analise o sentimento dos usuários e otimize a conversão." />

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Satisfação', value: `${metrics.avgRating.toFixed(1)}/5`,        icon: Star,         color: 'text-amber-600   dark:text-amber-400',   bg: 'bg-amber-500/15  border-amber-500/25  dark:bg-amber-400/10  dark:border-amber-400/20'  },
          { label: 'Conversão',  value: `${metrics.conversionRate.toFixed(0)}%`,    icon: TrendingUp,   color: 'text-cyan-600    dark:text-cyan-400',     bg: 'bg-cyan-500/15   border-cyan-500/25   dark:bg-cyan-400/10   dark:border-cyan-400/20'   },
          { label: 'Upgrades',   value: metrics.totalUpgrades,                      icon: ArrowUpRight, color: 'text-violet-600  dark:text-violet-400',  bg: 'bg-violet-500/15 border-violet-500/25 dark:bg-violet-400/10 dark:border-violet-400/20' },
          { label: 'Churn',      value: metrics.totalChurn,                         icon: TrendingDown, color: 'text-red-600     dark:text-red-400',      bg: 'bg-red-500/15    border-red-500/25    dark:bg-red-400/10    dark:border-red-400/20'    },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <p className="text-2xl font-bold text-foreground">{value}</p>
                </div>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${bg}`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-3">
          <h2 className="text-base font-semibold text-foreground mb-3">Depoimentos Recentes</h2>
          {feedbacks.length === 0 ? (
            <Empty>
              <EmptyContent>
                <EmptyHeader>
                  <EmptyMedia variant="icon"><MessageSquare /></EmptyMedia>
                  <EmptyTitle className="text-sm font-medium">Nenhum depoimento ainda</EmptyTitle>
                  <EmptyDescription>
                    Os feedbacks aparecerão aqui conforme os usuários avaliarem a plataforma.
                  </EmptyDescription>
                </EmptyHeader>
                <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
                  {isRefreshing
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <><RefreshCw className="w-4 h-4 mr-2" />Atualizar</>
                  }
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            feedbacks.map(fb => {
              const badge = ACTION_BADGE[fb.actionTaken] ?? ACTION_BADGE.pending
              const whatsappNumber = fb.userPhone?.replace(/\D/g, '')
              return (
                <Card key={fb.id}>
                  <CardContent className="pt-4 pb-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <StarRow rating={fb.rating} />
                        <Badge variant={badge.variant} className="text-xs">{badge.label}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(fb.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={`mailto:${fb.userEmail}`}
                          className="inline-flex items-center h-8 px-3 text-xs font-medium rounded-md border border-border bg-transparent hover:bg-accent hover:text-accent-foreground transition-colors"
                        >
                          <Mail className="w-3 h-3 mr-1" />
                          Email
                        </a>
                        {whatsappNumber && (
                          <a
                            href={`https://wa.me/55${whatsappNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center h-8 px-3 text-xs font-medium rounded-md border border-border bg-transparent hover:bg-accent hover:text-accent-foreground transition-colors"
                            >
                            <MessageCircle className="w-3 h-3 mr-1" />
                            Whats
                          </a>
                        )}
                      </div>
                    </div>
                    {fb.message && (
                      <p className="text-sm italic">"{fb.message}"</p>
                    )}
                    <Separator />
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>👤 {fb.userName}</span>
                      <span>✉ {fb.userEmail}</span>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
      </div>
    </div>
  )
}
