'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/console/status-badge'
import { Pencil, Check, Plus, Trash2, Zap, Loader2, LayoutList } from 'lucide-react'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty'
import { PageHeader } from '@/components/console/page-header'
import { toast } from 'sonner'
import { updatePlan, createPlan, deletePlan } from './actions'
import { API } from '@/lib/routes'
import { Button } from '@/components/ui/button'
import { UnderlineTabs } from '@/components/ui/underline-tabs'
import { AppDialog } from '@/components/ui/app-dialog'


export interface PlanFeature {
  id: string
  label: string
  active: boolean
}

export interface Plan {
  id: string
  name: string
  description: string
  price: number
  quota: number
  active: boolean
  features: PlanFeature[]
  sort_order?: number
}

// ─── shared field styles ───────────────────────────────────────────────────
const fieldClass = 'w-full bg-transparent border-b border-border px-2 pb-1.5 text-sm text-foreground focus:outline-none focus:border-highlight focus-visible:ring-1 focus-visible:ring-ring focus-visible:rounded-sm transition-colors'

// ─── EditModal ─────────────────────────────────────────────────────────────
interface EditModalProps {
  plan: Plan
  onSave: (updated: Plan) => Promise<void>
  onClose: () => void
}

function EditModal({ plan, onSave, onClose }: EditModalProps) {
  const [draft, setDraft] = useState<Plan>(JSON.parse(JSON.stringify(plan)))
  const [newFeature, setNewFeature] = useState('')
  const [saving, setSaving] = useState(false)

  function toggleFeature(id: string) {
    setDraft((p) => ({
      ...p,
      features: p.features.map((f) => f.id === id ? { ...f, active: !f.active } : f),
    }))
  }

  function removeFeature(id: string) {
    setDraft((p) => ({ ...p, features: p.features.filter((f) => f.id !== id) }))
  }

  function editFeature(id: string, label: string) {
    setDraft((p) => ({
      ...p,
      features: p.features.map((f) => f.id === id ? { ...f, label } : f),
    }))
  }

  function addFeature() {
    if (!newFeature.trim()) return
    setDraft((p) => ({
      ...p,
      features: [...p.features, { id: crypto.randomUUID(), label: newFeature.trim(), active: true }],
    }))
    setNewFeature('')
  }

  return (
    <AppDialog
      open
      onOpenChange={(o) => { if (!o) onClose() }}
      title={`Editar — ${plan.name}`}
      logoId="plan-edit-modal"
      maxWidth="max-w-lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button
            onClick={async () => { setSaving(true); await onSave(draft); setSaving(false) }}
            disabled={saving}
            style={{ background: 'var(--gradient-brand)', color: 'white' }}
          >
            {saving ? 'Aguarde...' : 'Salvar alterações'}
          </Button>
        </>
      }
    >
      <PlanFormFields draft={draft} setDraft={(fn) => setDraft((p) => ({ ...p, ...fn(p) }))} newFeature={newFeature} setNewFeature={setNewFeature} onAddFeature={addFeature} onToggleFeature={toggleFeature} onRemoveFeature={removeFeature} onEditFeature={editFeature} />
    </AppDialog>
  )
}

// ─── CreateModal ───────────────────────────────────────────────────────────
interface CreateModalProps {
  onSave: (plan: Omit<Plan, 'id'>) => Promise<void>
  onClose: () => void
  nextSortOrder: number
}

const emptyPlan = (sort_order: number): Omit<Plan, 'id'> => ({
  name: '',
  description: '',
  price: 0,
  quota: 0,
  active: true,
  features: [],
  sort_order,
})

function CreateModal({ onSave, onClose, nextSortOrder }: CreateModalProps) {
  const [draft, setDraft] = useState<Omit<Plan, 'id'>>(emptyPlan(nextSortOrder))
  const [newFeature, setNewFeature] = useState('')
  const [saving, setSaving] = useState(false)

  function toggleFeature(id: string) {
    setDraft((p) => ({
      ...p,
      features: p.features.map((f) => f.id === id ? { ...f, active: !f.active } : f),
    }))
  }

  function removeFeature(id: string) {
    setDraft((p) => ({ ...p, features: p.features.filter((f) => f.id !== id) }))
  }

  function editFeature(id: string, label: string) {
    setDraft((p) => ({
      ...p,
      features: p.features.map((f) => f.id === id ? { ...f, label } : f),
    }))
  }

  function addFeature() {
    if (!newFeature.trim()) return
    setDraft((p) => ({
      ...p,
      features: [...p.features, { id: crypto.randomUUID(), label: newFeature.trim(), active: true }],
    }))
    setNewFeature('')
  }

  return (
    <AppDialog
      open
      onOpenChange={(o) => { if (!o) onClose() }}
      title="Novo plano"
      logoId="plan-create-modal"
      maxWidth="max-w-lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button
            onClick={async () => { setSaving(true); await onSave(draft); setSaving(false) }}
            disabled={saving || !draft.name.trim()}
            style={{ background: 'var(--gradient-brand)', color: 'white' }}
          >
            {saving ? 'Aguarde...' : 'Criar plano'}
          </Button>
        </>
      }
    >
      <PlanFormFields draft={draft} setDraft={setDraft} newFeature={newFeature} setNewFeature={setNewFeature} onAddFeature={addFeature} onToggleFeature={toggleFeature} onRemoveFeature={removeFeature} onEditFeature={editFeature} />
    </AppDialog>
  )
}

// ─── DeletePlanModal ───────────────────────────────────────────────────────
interface DeletePlanModalProps {
  plan: Plan
  userCount: number
  onConfirm: () => Promise<void>
  onClose: () => void
}

function DeletePlanModal({ plan, userCount, onConfirm, onClose }: DeletePlanModalProps) {
  const [deleting, setDeleting] = useState(false)

  return (
    <AppDialog
      open
      onOpenChange={(o) => { if (!o) onClose() }}
      title="Remover plano"
      logoId="plan-delete-modal"
      maxWidth="max-w-sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={deleting}>Cancelar</Button>
          <Button
            variant="destructive"
            onClick={async () => { setDeleting(true); await onConfirm(); setDeleting(false) }}
            disabled={deleting}
          >
            {deleting ? 'Aguarde...' : 'Remover'}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">
        Tem certeza que deseja remover o plano <span className="font-medium text-foreground">{plan.name}</span>? Esta ação não pode ser desfeita.
      </p>
      {plan.active && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
          <span className="text-amber-600 dark:text-amber-400 text-xs mt-0.5">⚠</span>
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
            Este plano está <span className="font-semibold">ativo</span>
            {userCount === null
              ? ' e pode estar vinculado a profissionais.'
              : userCount === 0
                ? ' mas não possui profissionais vinculados.'
                : <> e possui <span className="font-semibold">{userCount} {userCount === 1 ? 'profissional vinculado' : 'profissionais vinculados'}</span>.</>
            }
            {' '}Removê-lo pode impactar usuários que utilizam este plano atualmente.
          </p>
        </div>
      )}
    </AppDialog>
  )
}

// ─── PlanFormFields (shared between Edit and Create) ───────────────────────
interface PlanFormFieldsProps {
  draft: Omit<Plan, 'id'>
  setDraft: (fn: (prev: Omit<Plan, 'id'>) => Omit<Plan, 'id'>) => void
  newFeature: string
  setNewFeature: (v: string) => void
  onAddFeature: () => void
  onToggleFeature: (id: string) => void
  onRemoveFeature: (id: string) => void
  onEditFeature: (id: string, label: string) => void
}

function PlanFormFields({ draft, setDraft, newFeature, setNewFeature, onAddFeature, onToggleFeature, onRemoveFeature, onEditFeature }: PlanFormFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="plan-name" className="text-xs text-muted-foreground">Nome</label>
        <input id="plan-name" name="plan-name" autoComplete="off" value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} className={fieldClass} />
      </div>

      <div className="space-y-1">
        <label htmlFor="plan-description" className="text-xs text-muted-foreground">Descrição</label>
        <input id="plan-description" name="plan-description" autoComplete="off" value={draft.description} onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))} className={fieldClass} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="plan-price" className="text-xs text-muted-foreground">Preço (R$/mês)</label>
          <input id="plan-price" name="plan-price" autoComplete="off" type="number" value={draft.price} onChange={(e) => setDraft((p) => ({ ...p, price: Number(e.target.value) }))} className={fieldClass} />
        </div>
        <div className="space-y-1">
          <label htmlFor="plan-quota" className="text-xs text-muted-foreground">Franquia (atendimentos/mês)</label>
          <input id="plan-quota" name="plan-quota" autoComplete="off" type="number" value={draft.quota} onChange={(e) => setDraft((p) => ({ ...p, quota: Number(e.target.value) }))} className={fieldClass} />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Plano ativo</span>
        <button
          aria-label="Plano ativo"
          onClick={() => setDraft((p) => ({ ...p, active: !p.active }))}
          // before: amplia a area tocavel para ~40px sem alterar o visual do trilho
          className={`w-9 h-5 rounded-full transition-colors relative before:absolute before:-inset-y-2.5 before:-inset-x-1 before:content-[''] ${draft.active ? 'bg-highlight' : 'bg-border'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${draft.active ? 'left-4' : 'left-0.5'}`} />
        </button>
      </div>

      <div className="space-y-2">
        <span className="text-xs text-muted-foreground">Funcionalidades</span>
        <div className="space-y-1">
          {draft.features.map((f) => (
            <div key={f.id} className="flex items-center gap-1 group">
              <button
                aria-label={f.active ? 'Desativar funcionalidade' : 'Ativar funcionalidade'}
                onClick={() => onToggleFeature(f.id)}
                className="shrink-0 p-2 -m-1 text-transparent transition-colors"
              >
                <span className={`inline-flex w-4 h-4 rounded border items-center justify-center ${f.active ? 'bg-highlight/20 border-highlight/40 text-highlight' : 'border-border text-transparent'}`}>
                  <Check className="h-2.5 w-2.5" />
                </span>
              </button>
              <input
                name={`plan-feature-${f.id}`}
                aria-label="Funcionalidade"
                autoComplete="off"
                value={f.label}
                onChange={(e) => onEditFeature(f.id, e.target.value)}
                className={`flex-1 bg-transparent border-b border-transparent focus:border-highlight pb-0.5 text-xs focus:outline-none transition-colors ${f.active ? 'text-foreground' : 'text-muted-foreground line-through'}`}
              />
              {/* Sempre visivel no mobile (sem hover no toque); some ate hover no desktop. */}
              <button
                aria-label="Remover funcionalidade"
                onClick={() => onRemoveFeature(f.id)}
                className="shrink-0 p-2 -m-1 text-muted-foreground hover:text-destructive opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all"
              >
                <Trash2 className="h-4 w-4 md:h-3 md:w-3" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1 pt-1">
          <input
            name="plan-new-feature"
            aria-label="Nova funcionalidade"
            autoComplete="off"
            value={newFeature}
            onChange={(e) => setNewFeature(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onAddFeature()}
            placeholder="Nova funcionalidade..."
            className="flex-1 bg-transparent border-b border-border pb-1 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-highlight transition-colors"
          />
          <button aria-label="Adicionar funcionalidade" onClick={onAddFeature} className="shrink-0 p-2 -m-1 text-highlight hover:text-highlight/70 transition-colors">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── PlansClient ───────────────────────────────────────────────────────────
export function PlansClient({ initialPlans }: { initialPlans: Plan[] }) {
  const [plans, setPlans] = useState<Plan[]>(initialPlans)
  const [activeTab, setActiveTab] = useState(0)
  const [editing, setEditing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deletingPlan, setDeletingPlan] = useState<{ plan: Plan; userCount: number } | null>(null)
  const [loadingDelete, setLoadingDelete] = useState(false)

  async function openDeleteModal(target: Plan) {
    setLoadingDelete(true)
    try {
      const res = await fetch(API.adminPlanId(target.id))
      const data = await res.json() as { userCount: number }
      setDeletingPlan({ plan: target, userCount: data.userCount })
    } catch {
      setDeletingPlan({ plan: target, userCount: 0 })
    } finally {
      setLoadingDelete(false)
    }
  }

  async function handleSave(updated: Plan) {
    const promise = updatePlan(updated).then((result) => {
      if (result.error) throw new Error(result.error)
      setPlans((prev) => prev.map((p) => p.id === updated.id ? updated : p))
      setEditing(false)
    })
    toast.promise(promise, {
      loading: 'Aguarde...',
      success: 'Plano atualizado com sucesso.',
      error: (err: Error) => `Erro: ${err.message}`,
    })
    await promise.catch(() => {})
  }

  async function handleCreate(plan: Omit<Plan, 'id'>) {
    const promise = createPlan(plan).then((result) => {
      if (result.error) throw new Error(result.error)
      const newPlan: Plan = { ...plan, id: result.id! }
      setPlans((prev) => [...prev, newPlan])
      setActiveTab(plans.length)
      setCreating(false)
    })
    toast.promise(promise, {
      loading: 'Aguarde...',
      success: 'Plano criado com sucesso.',
      error: (err: Error) => `Erro: ${err.message}`,
    })
    await promise.catch(() => {})
  }

  async function handleDelete() {
    if (!deletingPlan) return
    const targetId = deletingPlan.plan.id
    const promise = deletePlan(targetId).then((result) => {
      if (result.error) throw new Error(result.error)
      setPlans((prev) => {
        const next = prev.filter((p) => p.id !== targetId)
        setActiveTab((i) => Math.min(i, Math.max(0, next.length - 1)))
        return next
      })
      setDeletingPlan(null)
    })
    toast.promise(promise, {
      loading: 'Aguarde...',
      success: 'Plano removido.',
      error: (err: Error) => `Erro: ${err.message}`,
    })
    await promise.catch(() => {})
  }

  const action = (
    <Button size="lg" onClick={() => setCreating(true)} className="gap-2">
      <LayoutList className="h-3.5 w-3.5" />
      Novo plano
    </Button>
  )

  if (!plans.length) return (
    <div className="space-y-6">
      <PageHeader title="Planos" description="Gerencie os planos disponíveis na plataforma" action={action} />
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><LayoutList /></EmptyMedia>
          <EmptyTitle className="text-sm font-medium">Nenhum plano cadastrado</EmptyTitle>
          <EmptyDescription className="text-xs">Crie o primeiro plano para disponibilizá-lo na plataforma.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => setCreating(true)} className="gap-2">
            <Plus className="h-3.5 w-3.5" />
            Novo plano
          </Button>
        </EmptyContent>
      </Empty>
      {creating && <CreateModal onSave={handleCreate} onClose={() => setCreating(false)} nextSortOrder={1} />}
    </div>
  )

  const plan = plans[activeTab] ?? plans[0]

  return (
    <div className="space-y-6">
      <PageHeader title="Planos" description="Gerencie os planos disponíveis na plataforma" action={action} />

      <UnderlineTabs
        tabs={plans.map((p, i) => ({ id: String(i), label: p.name }))}
        active={String(activeTab)}
        onChange={(id) => setActiveTab(Number(id))}
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Badge className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">{plan.name.toUpperCase()}</Badge>
              <StatusBadge variant="plan" status={plan.active ? 'active' : 'inactive'} />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-foreground">{plan.name}</h2>
              <p className="text-xs text-muted-foreground italic mt-1">{plan.description}</p>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-xs text-muted-foreground">R$</span>
              <span className="text-4xl font-bold text-highlight">{plan.price}</span>
              <span className="text-xs text-muted-foreground">/mês</span>
            </div>

            <div className="p-3 rounded-lg border border-border bg-muted/20">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                {plan.id === 'experimental' ? 'Franquia de teste' : 'Franquia mensal'}
              </p>
              <p className="text-2xl font-bold text-foreground">
                {plan.quota >= 999 ? '∞' : plan.quota}
                <span className="text-xs font-normal text-muted-foreground ml-1.5">
                  {plan.id === 'experimental' ? 'atendimentos' : 'atendimentos/mês'}
                </span>
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(true)} className="flex-1 gap-2">
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </Button>
              <Button variant="destructive" onClick={() => openDeleteModal(plan)} disabled={loadingDelete} className="flex-1 gap-2">
                {loadingDelete ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Remover
              </Button>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-highlight" />
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider">O que contempla</p>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Lista de benefícios exibida para o profissional</p>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2">
            {plan.features.map((f, index) => (
              <div
                key={f.id}
                className={`flex items-center gap-2.5 px-1 py-2.5 border-b border-border transition-opacity ${
                  f.active ? '' : 'opacity-40'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-highlight/15 border border-highlight/30 flex items-center justify-center shrink-0">
                  <Check className="h-2.5 w-2.5 text-highlight" />
                </div>
                <span className="text-xs text-foreground">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {editing && (
        <EditModal plan={plan} onSave={handleSave} onClose={() => setEditing(false)} />
      )}
      {creating && (
        <CreateModal onSave={handleCreate} onClose={() => setCreating(false)} nextSortOrder={plans.length + 1} />
      )}
      {deletingPlan && (
        <DeletePlanModal plan={deletingPlan.plan} userCount={deletingPlan.userCount} onConfirm={handleDelete} onClose={() => setDeletingPlan(null)} />
      )}
    </div>
  )
}
