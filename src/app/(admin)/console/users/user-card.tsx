'use client'

import { Pencil, Trash2, ShieldOff, ShieldCheck, Zap, KeyRound, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/console/status-badge'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatBRL } from '@/lib/currency'
import type { UserRow } from './users-client'

interface UserCardProps {
  user: UserRow
  processing: boolean
  usdToBrl: number
  onEdit: (user: UserRow) => void
  onDelete: (user: UserRow) => void
  onToggleBlock: (user: UserRow) => void
  onInject: (user: UserRow) => void
  onResetPin: (user: UserRow) => void
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-foreground text-right min-w-0 break-words">{value}</span>
    </div>
  )
}

// Apresentacao mobile (<md) da lista de usuarios — reaproveita os handlers do
// UsersClient. Acoes criticas master com alvos de toque >=40px (h-10).
export function UserCard({
  user: u, processing, usdToBrl, onEdit, onDelete, onToggleBlock, onInject, onResetPin,
}: UserCardProps) {
  return (
    <div data-testid="user-card" className="rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="h-9 w-9 rounded-lg shrink-0 flex items-center justify-center text-xs font-semibold text-white"
          style={{ background: 'var(--gradient-brand)' }}
        >
          {getInitials(u.name)}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{u.name}</p>
          <p className="text-xs text-muted-foreground break-all">{u.email}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Field label="Especialidade" value={u.specialty ?? '—'} />
        <Field label="Status" value={<StatusBadge variant="user" status={u.status} />} />
        <Field label="Créditos" value={u.credits} />
        <Field
          label="Custo Groq"
          value={
            <span className="font-mono text-xs">
              <span className="font-semibold text-primary">${u.groqCost.toFixed(4)}</span>
              <span className="text-muted-foreground"> · {formatBRL(u.groqCost, usdToBrl)}</span>
            </span>
          }
        />
        <Field label="Cadastro" value={formatDate(u.createdAt)} />
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          onClick={() => onEdit(u)}
          variant="outline"
          className="flex-1 h-10 gap-1.5"
        >
          <Pencil className="h-4 w-4" />
          Editar
        </Button>
        <Button
          onClick={() => onDelete(u)}
          disabled={processing}
          variant="outline"
          className="flex-1 h-10 gap-1.5 text-red-600 dark:text-red-400 hover:bg-red-500/10"
        >
          <Trash2 className="h-4 w-4" />
          {processing ? 'Aguarde...' : 'Excluir'}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" aria-label="Mais ações">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={() => onToggleBlock(u)}
              disabled={processing}
              className={u.blocked ? 'text-emerald-600 dark:text-emerald-400 focus:text-emerald-600 dark:focus:text-emerald-400' : ''}
            >
              {u.blocked
                ? <><ShieldCheck className="h-3.5 w-3.5 mr-2" /> Desbloquear</>
                : <><ShieldOff className="h-3.5 w-3.5 mr-2" /> Bloquear</>
              }
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onInject(u)}>
              <Zap className="h-3.5 w-3.5 mr-2" /> Injetar créditos
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onResetPin(u)}
              className={u.pinIsTemp ? 'text-amber-600 dark:text-amber-400 focus:text-amber-600 dark:focus:text-amber-400' : ''}
            >
              <KeyRound className="h-3.5 w-3.5 mr-2" />
              {u.pinIsTemp ? 'PIN temporário ativo' : u.hasPin ? 'Redefinir PIN' : 'Gerar PIN'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
