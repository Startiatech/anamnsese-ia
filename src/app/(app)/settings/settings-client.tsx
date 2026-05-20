'use client'

import { useRef, useState } from 'react'
import { User, Lock, ArrowRight, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { TabProfile, type ProfileHandle } from './tabs/tab-profile'
import { TabSecurity, type SecurityHandle } from './tabs/tab-security'
import { OnboardingIntroModal } from '@/components/dashboard/onboarding-intro-modal'
import type { StoredUser } from '@/server/repositories/users'
import { ROUTES } from '@/lib/routes'
import { UnderlineTabs } from '@/components/ui/underline-tabs'

type TabId = 'perfil' | 'seguranca'

interface SettingsClientProps {
  user: StoredUser
  isOnboarding?: boolean
  isPasswordReset?: boolean
  isPinReset?: boolean
  profileCompleted?: boolean
  showIntro?: boolean
  deletionScheduledAt?: string | null
}

export function SettingsClient({ user, isOnboarding = false, isPasswordReset = false, isPinReset = false, profileCompleted = false, showIntro = false, deletionScheduledAt }: SettingsClientProps) {
  const profileRef = useRef<ProfileHandle>(null)
  const securityRef = useRef<SecurityHandle>(null)

  const [active, setActive] = useState<TabId>(isPasswordReset ? 'seguranca' : 'perfil')
  const [profileValidated, setProfileValidated] = useState(profileCompleted)
  const [saving, setSaving] = useState(false)

  // No reset de senha, aba segurança nunca fica bloqueada
  const securityLocked = isOnboarding && !isPasswordReset && !profileValidated

  const TABS: { id: TabId; label: string; icon: typeof User; locked: boolean }[] = [
    { id: 'perfil',    label: 'Perfil',    icon: User, locked: isPasswordReset },
    { id: 'seguranca', label: 'Segurança', icon: Lock, locked: securityLocked },
  ]

  const buttonLabel = active === 'perfil' ? 'Próxima etapa' : 'Salvar alterações'
  const ButtonIcon  = active === 'perfil' ? ArrowRight : Save

  async function handleProceed() {
    if (active === 'perfil') {
      // Só valida localmente — nenhuma chamada à API
      const valid = await profileRef.current?.validate()
      if (valid) {
        setProfileValidated(true)
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
    const { currentPassword, newPassword } = securityRef.current!.getValues()

    setSaving(true)

    const promise = (async () => {
      // 1. Salva perfil
      const r1 = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
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

  return (
    <div className="space-y-6">

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

      {/* Ambos os tabs sempre montados — CSS hidden evita o problema de remount */}
      <div className={active === 'perfil' ? '' : 'hidden'}>
        <TabProfile ref={profileRef} user={user} isOnboarding={isOnboarding} />
      </div>
      <div className={active === 'seguranca' ? '' : 'hidden'}>
        <TabSecurity ref={securityRef} userId={user.id} isOnboarding={isOnboarding} isPasswordReset={isPasswordReset} isPinReset={isPinReset} deletionScheduledAt={deletionScheduledAt} hasPin={!!user.pinHash} />
      </div>

      <OnboardingIntroModal show={showIntro} userName={user.name} />

      {/* Botão único — apenas no onboarding */}
      {isOnboarding && (
        <div className="flex justify-end">
          <Button type="button" onClick={handleProceed} disabled={saving} className="gap-2">
            {saving ? 'Aguarde...' : buttonLabel}
            {!saving && <ButtonIcon className="h-3.5 w-3.5" />}
          </Button>
        </div>
      )}
    </div>
  )
}
