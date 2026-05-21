'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, Lock, ArrowRight, Save, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { TabProfile, type ProfileHandle } from './tabs/tab-profile'
import { TabSecurity, type SecurityHandle } from './tabs/tab-security'
import { TabClinic, type ClinicHandle } from './tabs/tab-clinic'
import { OnboardingIntroModal } from '@/components/dashboard/onboarding-intro-modal'
import type { StoredUser } from '@/server/repositories/users'
import { ROUTES } from '@/lib/routes'
import { UnderlineTabs } from '@/components/ui/underline-tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Logo } from '@/components/ui/logo'

type TabId = 'perfil' | 'clinica' | 'seguranca'

interface SettingsClientProps {
  user: StoredUser
  isOnboarding?: boolean
  isPasswordReset?: boolean
  isPinReset?: boolean
  profileCompleted?: boolean
  clinicCompleted?: boolean
  showIntro?: boolean
  deletionScheduledAt?: string | null
  forceClinic?: boolean
}

export function SettingsClient({
  user,
  isOnboarding = false,
  isPasswordReset = false,
  isPinReset = false,
  profileCompleted = false,
  clinicCompleted = false,
  showIntro = false,
  deletionScheduledAt,
  forceClinic = false,
}: SettingsClientProps) {
  const profileRef = useRef<ProfileHandle>(null)
  const securityRef = useRef<SecurityHandle>(null)
  const clinicRef = useRef<ClinicHandle>(null)

  const initialTab: TabId = forceClinic ? 'clinica' : isPasswordReset ? 'seguranca' : 'perfil'

  const [active, setActive] = useState<TabId>(initialTab)
  const [profileValidated, setProfileValidated] = useState(profileCompleted)
  const [clinicValidated, setClinicValidated] = useState(clinicCompleted)
  const [saving, setSaving] = useState(false)
  const [clinicSavedDialogOpen, setClinicSavedDialogOpen] = useState(false)

  // Locking logic
  const clinicLocked = isOnboarding && !isPasswordReset && !profileValidated
  const securityLocked = isOnboarding && !isPasswordReset && (!profileValidated || !clinicValidated)

  const TABS: { id: TabId; label: string; icon: typeof User; locked: boolean }[] = forceClinic
    ? [
        { id: 'perfil',    label: 'Perfil',    icon: User,      locked: true },
        { id: 'clinica',   label: 'Clínica',   icon: Building2, locked: false },
        { id: 'seguranca', label: 'Segurança', icon: Lock,      locked: true },
      ]
    : [
        { id: 'perfil',    label: 'Perfil',    icon: User,      locked: isPasswordReset },
        { id: 'clinica',   label: 'Clínica',   icon: Building2, locked: clinicLocked },
        { id: 'seguranca', label: 'Segurança', icon: Lock,      locked: securityLocked },
      ]

  // Button label: forceClinic salva e fica em settings; onboarding avança/salva
  const buttonLabel = forceClinic
    ? 'Salvar dados da clínica'
    : active === 'seguranca'
      ? 'Salvar alterações'
      : 'Próxima etapa'
  const ButtonIcon  = active === 'seguranca' ? Save : ArrowRight

  const router = useRouter()

  async function handleForceClinicSave() {
    const valid = await clinicRef.current?.validate()
    if (!valid) return

    const clinicData = clinicRef.current!.getValues()

    setSaving(true)

    const promise = (async () => {
      const r = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clinicData),
      })
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error(body.error ?? 'Erro ao salvar dados da clínica')
      }
    })()

    toast.promise(promise, {
      loading: 'Aguarde...',
      success: 'Dados da clínica salvos!',
      error: (e: Error) => e.message,
    })

    try {
      await promise
      setClinicValidated(true)
      router.refresh()
      setClinicSavedDialogOpen(true)
    } catch {
      // toast.promise já mostrou o erro
    } finally {
      setSaving(false)
    }
  }

  async function handleProceed() {
    if (active === 'perfil') {
      const valid = await profileRef.current?.validate()
      if (valid) {
        setProfileValidated(true)
        setActive('clinica')
      }
      return
    }

    if (active === 'clinica') {
      const valid = await clinicRef.current?.validate()
      if (valid) {
        setClinicValidated(true)
        setActive('seguranca')
      }
      return
    }

    // Tab segurança: valida e salva tudo de uma vez
    const secValid = await securityRef.current?.validate()
    if (!secValid) return

    // PIN obrigatório: no reset pelo admin OU no primeiro acesso (onboarding sem password reset)
    const pinRequired = isPinReset || (isOnboarding && !isPasswordReset)
    if (pinRequired && !securityRef.current?.pinSaved) {
      toast.error('Cadastre um PIN antes de continuar.')
      return
    }

    // Fluxo banner: só atualizou PIN (sem passwordIsTemp) — PIN já foi salvo, só redireciona
    if (isPinReset && !isOnboarding) {
      window.location.href = ROUTES.dashboard
      return
    }

    const profileData = profileRef.current!.getValues()
    const clinicData = clinicRef.current!.getValues()
    const { currentPassword, newPassword } = securityRef.current!.getValues()

    setSaving(true)

    const promise = (async () => {
      // 1. Salva perfil + clínica juntos
      const r1 = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...profileData, ...clinicData }),
      })
      if (!r1.ok) throw new Error('Erro ao salvar perfil')

      // 2. Atualiza senha
      const r2 = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (!r2.ok) {
        const body = await r2.json().catch(() => ({}))
        throw new Error(body.error ?? 'Erro ao atualizar senha')
      }

      window.location.href = '/dashboard?welcome=1'
    })()

    toast.promise(promise, {
      loading: 'Aguarde...',
      success: 'Tudo pronto! Redirecionando...',
      error: (e: Error) => e.message,
    })

    await promise.catch(() => {}).finally(() => setSaving(false))
  }

  const showProceedButton = isOnboarding || forceClinic

  return (
    <div className="space-y-6">

      {forceClinic && (
        <div className="rounded-md border border-amber-300 bg-amber-100 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          Complete os dados da sua clínica para iniciar um novo atendimento.
        </div>
      )}

      <UnderlineTabs
        tabs={TABS.map(({ id, label, icon, locked }) => ({
          id,
          label,
          icon,
          disabled: locked,
          disabledTitle: locked ? 'Complete o perfil primeiro' : undefined,
        }))}
        active={active}
        onChange={setActive}
      />

      {/* Todos os tabs sempre montados — CSS hidden evita o problema de remount */}
      <div className={active === 'perfil' ? '' : 'hidden'}>
        <TabProfile ref={profileRef} user={user} isOnboarding={isOnboarding} />
      </div>
      <div className={active === 'clinica' ? '' : 'hidden'}>
        <TabClinic ref={clinicRef} user={user} isOnboarding={isOnboarding || forceClinic} />
      </div>
      <div className={active === 'seguranca' ? '' : 'hidden'}>
        <TabSecurity ref={securityRef} userId={user.id} isOnboarding={isOnboarding} isPasswordReset={isPasswordReset} isPinReset={isPinReset} deletionScheduledAt={deletionScheduledAt} hasPin={!!user.pinHash} />
      </div>

      <OnboardingIntroModal show={showIntro} userName={user.name} />

      {/* Botão único — apenas no onboarding ou forceClinic */}
      {showProceedButton && (
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={forceClinic ? handleForceClinicSave : handleProceed}
            disabled={saving}
            className="gap-2"
          >
            {saving ? 'Aguarde...' : buttonLabel}
            {!saving && <ButtonIcon className="h-3.5 w-3.5" />}
          </Button>
        </div>
      )}

      <AlertDialog open={clinicSavedDialogOpen} onOpenChange={setClinicSavedDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex flex-col items-center gap-4 mb-4">
              <Logo size="sm" id="clinic-saved-modal" />
              <div className="w-full h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
            </div>
            <AlertDialogTitle>Dados salvos com sucesso!</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Os dados da sua clínica foram atualizados. Agora você já pode iniciar
                  um novo atendimento.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar em Configurações</AlertDialogCancel>
            <AlertDialogAction onClick={() => router.push(ROUTES.atendimento)}>
              Ir para Atendimentos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
