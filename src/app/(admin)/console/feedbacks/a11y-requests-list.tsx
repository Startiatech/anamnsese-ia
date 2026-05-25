'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, Archive, Mail, MessageSquarePlus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyMedia, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { markRequestAsRead, archiveRequest } from '@/server/actions/accessibility-requests'
import type { AccessibilityRequestWithUser, AccessibilityRequestStatus } from '@/server/repositories/accessibility-requests'

interface A11yRequestsListProps {
  items: AccessibilityRequestWithUser[]
}

const STATUS_BADGE: Record<AccessibilityRequestStatus, { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' }> = {
  pending:  { label: 'PENDENTE', variant: 'secondary' },
  read:     { label: 'LIDO',     variant: 'outline' },
  archived: { label: 'ARQUIVADO', variant: 'outline' },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function A11yRequestsList({ items }: A11yRequestsListProps) {
  const router = useRouter()
  const [processingId, setProcessingId] = useState<string | null>(null)

  if (items.length === 0) {
    return (
      <Empty>
        <EmptyMedia variant="icon">
          <MessageSquarePlus className="h-8 w-8 text-muted-foreground" />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>Nenhum pedido até agora</EmptyTitle>
          <EmptyDescription>
            Quando profissionais enviarem pedidos de novos ajustes de acessibilidade, eles aparecem aqui.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  async function handleMarkAsRead(id: string) {
    setProcessingId(id)
    const promise = markRequestAsRead(id).then((res) => {
      if (!res.ok) throw new Error(res.error ?? 'Erro ao atualizar')
      return res
    })
    toast.promise(promise, {
      loading: 'Aguarde...',
      success: 'Marcado como lido.',
      error: (e: Error) => e.message,
    })
    try { await promise; router.refresh() } catch { /* toast */ }
    finally { setProcessingId(null) }
  }

  async function handleArchive(id: string) {
    setProcessingId(id)
    const promise = archiveRequest(id).then((res) => {
      if (!res.ok) throw new Error(res.error ?? 'Erro ao arquivar')
      return res
    })
    toast.promise(promise, {
      loading: 'Aguarde...',
      success: 'Pedido arquivado.',
      error: (e: Error) => e.message,
    })
    try { await promise; router.refresh() } catch { /* toast */ }
    finally { setProcessingId(null) }
  }

  return (
    <div className="space-y-3">
      {items.map((req) => {
        const badge = STATUS_BADGE[req.status]
        const isProcessing = processingId === req.id
        const isActionable = req.status === 'pending'
        return (
          <Card key={req.id}>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {req.userName ?? '(usuário removido)'}
                  </p>
                  {req.userEmail && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                      <Mail className="h-3 w-3 shrink-0" />
                      {req.userEmail}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatDate(req.createdAt)}
                  </span>
                </div>
              </div>

              <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap mb-3">
                {req.message}
              </p>

              {isActionable && (
                <div className="flex items-center gap-2 pt-2 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isProcessing}
                    onClick={() => handleMarkAsRead(req.id)}
                  >
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Marcar como lido
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isProcessing}
                    onClick={() => handleArchive(req.id)}
                  >
                    <Archive className="h-3.5 w-3.5 mr-1" />
                    Arquivar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
