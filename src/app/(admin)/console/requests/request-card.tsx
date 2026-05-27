'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/console/status-badge'
import type { AccessRequest } from '@/lib/types'

const MESSAGE_COLLAPSE_THRESHOLD = 120

interface RequestCardProps {
  request: AccessRequest
  processing: boolean
  onApprove: (request: AccessRequest) => void
  onReject: (request: AccessRequest) => void
  onViewCredentials: (request: AccessRequest) => void
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-foreground text-right min-w-0 break-words">{value}</span>
    </div>
  )
}

export function RequestCard({
  request, processing, onApprove, onReject, onViewCredentials,
}: RequestCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div data-testid="request-card" className="rounded-xl border border-border p-4 space-y-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{request.name}</p>
        <p className="text-xs text-muted-foreground break-all">{request.email}</p>
      </div>

      <div className="space-y-1.5">
        <Field label="Especialidade" value={request.specialty} />
        <Field label="Telefone" value={request.phone} />
        <Field label="Situação" value={<StatusBadge variant="request" status={request.status} />} />
        <Field label="Data" value={formatDate(request.createdAt)} />
      </div>

      {request.message && (
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Mensagem</span>
          <p className={`text-sm italic text-foreground ${expanded ? '' : 'line-clamp-3'}`}>
            &ldquo;{request.message}&rdquo;
          </p>
          {request.message.length > MESSAGE_COLLAPSE_THRESHOLD && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-primary underline py-2 px-1 -mx-1 active:opacity-70"
            >
              {expanded ? 'ver menos' : 'ver mais'}
            </button>
          )}
        </div>
      )}

      {request.status === 'pending' && (
        <div className="flex gap-2 pt-1">
          <Button
            onClick={() => onApprove(request)}
            disabled={processing}
            className="flex-1 h-10 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <CheckCircle className="h-4 w-4" />
            {processing ? 'Aguarde...' : 'Aprovar'}
          </Button>
          <Button
            onClick={() => onReject(request)}
            disabled={processing}
            variant="outline"
            className="flex-1 h-10 gap-1.5 text-red-600 dark:text-red-400"
          >
            <XCircle className="h-4 w-4" />
            {processing ? 'Aguarde...' : 'Rejeitar'}
          </Button>
        </div>
      )}

      {request.status === 'approved' && request.userPasswordIsTemp && (
        <Button
          onClick={() => onViewCredentials(request)}
          disabled={processing}
          variant="outline"
          className="w-full h-10 gap-1.5"
        >
          <KeyRound className="h-4 w-4" />
          {processing ? 'Aguarde...' : 'Ver credenciais'}
        </Button>
      )}
    </div>
  )
}
