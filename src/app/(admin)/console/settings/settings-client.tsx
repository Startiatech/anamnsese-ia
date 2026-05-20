'use client'

import { useState } from 'react'
import { User, Lock } from 'lucide-react'
import { PageHeader } from '@/components/console/page-header'
import { UnderlineTabs } from '@/components/ui/underline-tabs'
import { TabProfile } from './tabs/tab-profile'
import { TabSecurity } from './tabs/tab-security'

type TabId = 'perfil' | 'seguranca'

const TABS: { id: TabId; label: string; icon: typeof User }[] = [
  { id: 'perfil',    label: 'Perfil',    icon: User },
  { id: 'seguranca', label: 'Segurança', icon: Lock },
]

export function SettingsClient({ userName }: { userName: string }) {
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
        <TabProfile userName={userName} />
      </div>
      <div className={active === 'seguranca' ? '' : 'hidden'}>
        <TabSecurity userName={userName} />
      </div>
    </div>
  )
}
