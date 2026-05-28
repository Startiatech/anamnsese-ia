'use client'

import { useState } from 'react'
import { User, Lock, Accessibility } from 'lucide-react'
import { PageHeader } from '@/components/console/page-header'
import { UnderlineTabs } from '@/components/ui/underline-tabs'
import { TabProfile } from './tabs/tab-profile'
import { TabSecurity } from './tabs/tab-security'
import { TabAccessibility } from '@/app/(app)/app/settings/tabs/tab-accessibility'

type TabId = 'perfil' | 'seguranca' | 'acessibilidade'

const TABS: { id: TabId; label: string; icon: typeof User }[] = [
  { id: 'perfil',         label: 'Perfil',        icon: User },
  { id: 'seguranca',      label: 'Segurança',     icon: Lock },
  { id: 'acessibilidade', label: 'Acessibilidade', icon: Accessibility },
]

interface SettingsClientProps {
  userName: string
  userEmail: string
  userPhone: string
}

export function SettingsClient({ userName, userEmail, userPhone }: SettingsClientProps) {
  const [active, setActive] = useState<TabId>('perfil')

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Gerencie seu perfil e parâmetros do sistema." />

      <UnderlineTabs
        tabs={TABS.map(({ id, label, icon }) => ({ id, label, icon }))}
        active={active}
        onChange={setActive}
      />

      <div className={active === 'perfil' ? '' : 'hidden'}>
        <TabProfile userName={userName} userEmail={userEmail} userPhone={userPhone} />
      </div>
      <div className={active === 'seguranca' ? '' : 'hidden'}>
        <TabSecurity userName={userName} />
      </div>
      <div className={active === 'acessibilidade' ? '' : 'hidden'}>
        <TabAccessibility showRequestCard={false} />
      </div>
    </div>
  )
}
