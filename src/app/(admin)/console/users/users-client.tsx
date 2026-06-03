'use client'

import { useState, useMemo } from 'react'
import {
  UserPlus, Users, Pencil, Trash2, ShieldOff, ShieldCheck, Zap, KeyRound, Search, MoreHorizontal, X, SearchX,
} from 'lucide-react'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty'
import { PageHeader } from '@/components/console/page-header'
import { StatusBadge } from '@/components/console/status-badge'
import { toast } from 'sonner'
import { API } from '@/lib/routes'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatBRL } from '@/lib/currency'
import { UserCard } from './user-card'
import { AddUserModal } from './add-user-modal'
import { EditUserModal } from './edit-user-modal'
import { DeleteUserModal, type DeleteSummary } from './delete-user-modal'
import { InjectCreditsModal } from './inject-credits-modal'
import { ResetPinModal } from './reset-pin-modal'

export interface UserRow {
  id: string
  name: string
  email: string
  specialty?: string
  phone?: string
  createdAt: string
  blocked: boolean
  credits: number
  groqCost: number
  status: 'onboarding' | 'active' | 'blocked'
  hasPin: boolean
  pinIsTemp: boolean
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}


type StatusFilter = 'all' | UserRow['status']

export function UsersClient({ initialUsers, usdToBrl = 5.75 }: { initialUsers: UserRow[], usdToBrl?: number }) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers)
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null)
  const [deleteSummary, setDeleteSummary] = useState<DeleteSummary | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [injectUser, setInjectUser] = useState<UserRow | null>(null)
  const [resetPinUser, setResetPinUser] = useState<UserRow | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return users.filter((u) => {
      const matchesSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'all' || u.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [users, searchQuery, statusFilter])

  function handleCreditsInjected(userId: string, newTotal: number) {
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, credits: newTotal } : u))
  }

  function handleCreated(user: UserRow) {
    setUsers((prev) => [user, ...prev])
    setShowCreate(false)
  }

  function handleSaved(updated: UserRow) {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
    setEditUser(null)
  }

  async function openDeleteModal(user: UserRow) {
    setProcessingId(user.id)
    try {
      const res = await fetch(API.adminUserId(user.id))
      const summary: DeleteSummary = await res.json()
      setDeleteSummary(summary)
      setDeleteUser(user)
    } catch {
      toast.error('Erro ao verificar dados do usuário')
    } finally {
      setProcessingId(null)
    }
  }

  function handleDeleted(id: string) {
    setUsers((prev) => prev.filter((u) => u.id !== id))
    setDeleteUser(null)
    setDeleteSummary(null)
  }

  async function handleToggleBlock(user: UserRow) {
    const newBlocked = !user.blocked
    setProcessingId(user.id)
    const promise = fetch(API.adminUserId(user.id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocked: newBlocked }),
    }).then(async (res) => {
      if (!res.ok) throw new Error('Erro ao alterar status')
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, blocked: newBlocked, status: newBlocked ? 'blocked' : 'active' }
            : u
        )
      )
    })
    toast.promise(promise, {
      loading: 'Aguarde...',
      success: newBlocked ? 'Usuário bloqueado' : 'Usuário desbloqueado',
      error: (e: Error) => e.message,
    })
    await promise.catch(() => {}).finally(() => setProcessingId(null))
  }

  const action = (
    <Button size="lg" onClick={() => setShowCreate(true)} className="gap-2">
      <UserPlus className="h-3.5 w-3.5" />
      Novo usuário
    </Button>
  )

  return (
    <>
      <div className="space-y-6">
        <PageHeader title="Usuários" description="Profissionais com acesso à plataforma" action={action} />

        {users.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><Users /></EmptyMedia>
              <EmptyTitle className="text-sm font-medium">Nenhum usuário cadastrado</EmptyTitle>
              <EmptyDescription className="text-xs">Crie o primeiro usuário para liberar acesso à plataforma.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => setShowCreate(true)} className="gap-2">
                <UserPlus className="h-3.5 w-3.5" />
                Novo usuário
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
              <div className="relative flex-1 sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="search"
                  name="user-search"
                  autoComplete="off"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nome ou e-mail..."
                  className="w-full pl-9 pr-8 py-2 text-sm bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Limpar busca"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Select name="status-filter" value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="h-9 w-full sm:w-36 text-sm bg-card border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="blocked">Bloqueado</SelectItem>
                  <SelectItem value="onboarding">Onboarding</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filteredUsers.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon"><SearchX /></EmptyMedia>
                  <EmptyTitle className="text-sm font-medium">Nenhum usuário encontrado</EmptyTitle>
                  <EmptyDescription className="text-xs">Tente ajustar os filtros ou limpar a busca.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <>
              {/* Mobile (<md): lista de cards — reaproveita os mesmos handlers.
                  Acoes criticas master com alvos de toque >=40px. */}
              <div className="grid gap-3 md:hidden">
                {filteredUsers.map((u) => (
                  <UserCard
                    key={u.id}
                    user={u}
                    processing={processingId === u.id}
                    usdToBrl={usdToBrl}
                    onEdit={setEditUser}
                    onDelete={openDeleteModal}
                    onToggleBlock={handleToggleBlock}
                    onInject={setInjectUser}
                    onResetPin={setResetPinUser}
                  />
                ))}
              </div>

              {/* Tablet+ (>=md): tabela densa. Sem overflow-hidden (cortaria o
                  scroll interno do Table shadcn). */}
              <div className="hidden md:block rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Profissional</TableHead>
                      <TableHead className="hidden md:table-cell">Especialidade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden sm:table-cell text-right">Créditos</TableHead>
                      <TableHead className="hidden lg:table-cell text-right">Custo Groq</TableHead>
                      <TableHead className="hidden xl:table-cell">Cadastro</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="h-8 w-8 rounded-lg shrink-0 flex items-center justify-center text-xs font-semibold text-white"
                              style={{ background: 'var(--gradient-brand)' }}
                            >
                              {getInitials(u.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{u.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {u.specialty ?? '—'}
                        </TableCell>
                        <TableCell>
                          <StatusBadge variant="user" status={u.status} />
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-right text-sm text-muted-foreground">
                          {u.credits}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-right font-mono text-xs">
                          <span className="font-semibold text-primary">${u.groqCost.toFixed(4)}</span>
                          <p className="text-muted-foreground mt-0.5">{formatBRL(u.groqCost, usdToBrl)}</p>
                        </TableCell>
                        <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                          {formatDate(u.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditUser(u)}
                              title="Editar"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDeleteModal(u)}
                              disabled={processingId === u.id}
                              className="hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10"
                              title="Excluir"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  onClick={() => handleToggleBlock(u)}
                                  disabled={processingId === u.id}
                                  className={u.blocked ? 'text-emerald-600 dark:text-emerald-400 focus:text-emerald-600 dark:focus:text-emerald-400' : ''}
                                >
                                  {u.blocked
                                    ? <><ShieldCheck className="h-3.5 w-3.5 mr-2" /> Desbloquear</>
                                    : <><ShieldOff className="h-3.5 w-3.5 mr-2" /> Bloquear</>
                                  }
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setInjectUser(u)}>
                                  <Zap className="h-3.5 w-3.5 mr-2" /> Injetar créditos
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setResetPinUser(u)}
                                  className={u.pinIsTemp ? 'text-amber-600 dark:text-amber-400 focus:text-amber-600 dark:focus:text-amber-400' : ''}
                                >
                                  <KeyRound className="h-3.5 w-3.5 mr-2" />
                                  {u.pinIsTemp ? 'PIN temporário ativo' : u.hasPin ? 'Redefinir PIN' : 'Gerar PIN'}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              </>
            )}
          </>
        )}
      </div>

      <AddUserModal open={showCreate} onClose={() => setShowCreate(false)} onSuccess={handleCreated} />
      <EditUserModal user={editUser} open={!!editUser} onClose={() => setEditUser(null)} onSuccess={handleSaved} usdToBrl={usdToBrl} />
      <DeleteUserModal
        user={deleteUser}
        summary={deleteSummary}
        open={!!deleteUser && !!deleteSummary}
        onClose={() => { setDeleteUser(null); setDeleteSummary(null) }}
        onSuccess={() => deleteUser && handleDeleted(deleteUser.id)}
      />
      <InjectCreditsModal user={injectUser} open={!!injectUser} onClose={() => setInjectUser(null)} onSuccess={handleCreditsInjected} />
      <ResetPinModal
        user={resetPinUser}
        open={!!resetPinUser}
        onClose={() => setResetPinUser(null)}
        onSuccess={(id) => setUsers((prev) => prev.map((u) => u.id === id ? { ...u, hasPin: true, pinIsTemp: true } : u))}
      />
    </>
  )
}
