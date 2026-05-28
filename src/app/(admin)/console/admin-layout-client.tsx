'use client'

import { useRouter } from 'next/navigation'
import { AppProvider, useApp } from '@/context/app-context'
import { AccessibilityProvider, type FontSize } from '@/context/accessibility-context'
import { KeyboardShortcutsProvider } from '@/components/ui/keyboard-shortcuts-modal'
import { SkipLink } from '@/components/ui/skip-link'
import { ConsoleNotificationProvider, useConsoleNotification } from '@/context/console-notification-context'
import { AppSidebar } from '@/components/layout/sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { ScrollToTop } from '@/components/ui/scroll-to-top'
import { LayoutDashboard, Users, ClipboardList, CreditCard, Settings, MessageSquare, Megaphone, Bell } from 'lucide-react'
import { ROUTES } from '@/lib/routes'
import type { AccessRequest } from '@/lib/types'
import type { User } from '@/types'
import type { Notification } from '@/server/repositories/notifications'

function AdminShell({ children, interestCount, initialNotifications, initialNotificationsUnread }: { children: React.ReactNode; interestCount: number; initialNotifications: Notification[]; initialNotificationsUnread: number }) {
  const { user, logout } = useApp()
  const { pendingCount, a11yPendingCount } = useConsoleNotification()
  const router = useRouter()

  async function handleLogout() {
    await logout()
    router.push('/login')
  }

  const navItems = [
    { href: '/console',              label: 'Dashboard',     icon: LayoutDashboard, exact: true },
    { href: '/console/requests',     label: 'Solicitações',  icon: ClipboardList, badge: pendingCount },
    { href: '/console/users',        label: 'Usuários',      icon: Users },
    { href: '/console/plans',        label: 'Planos',        icon: CreditCard },
    { href: ROUTES.consoleSettings,  label: 'Configurações', icon: Settings },
    { href: ROUTES.consoleFeedbacks,  label: 'Feedbacks',   icon: MessageSquare, badge: a11yPendingCount > 0 ? a11yPendingCount : undefined },
    { href: ROUTES.consoleInteresses, label: 'Interesses',  icon: Bell, badge: interestCount > 0 ? interestCount : undefined },
  ]

  const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://magenta-hornet-184625.hostingersite.com'
  const broadcastMessage = [
    'Olá! 👋',
    '',
    'Quero te apresentar o *Anamnese IA* — uma ferramenta que estou desenvolvendo para ajudar profissionais de saúde a registrar atendimentos com mais agilidade usando inteligência artificial.',
    '',
    'A ideia é simples: você faz o atendimento, a IA cuida da documentação. Resumo da anamnese, histórico do paciente e tudo organizado em um só lugar.',
    '',
    `🔗 *Link para acesso:* ${appUrl}`,
    '',
    'É uma versão de testes, então qualquer feedback é muito bem-vindo — se algo travar, parecer estranho ou não fizer sentido, me conta! Isso me ajuda demais. 🙏',
    '',
    'Qualquer dúvida é só chamar. Valeu!',
    '',
    '*Leonardo Oliveira* — https://wa.me/5532999447711',
    'Em parceria com *Startia Technology* — http://startiatechnology.com/',
  ].join('\n')

  const actionItems = [
    {
      label: 'Disparar divulgação',
      icon: Megaphone,
      onClick: () => { window.open(`https://wa.me/?text=${encodeURIComponent(broadcastMessage)}`, '_blank') },
      className: 'bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-semibold hover:opacity-90 hover:text-white active:text-white',
    },
  ]

  return (
    <>
    <SkipLink />
    <SidebarProvider>
      <AppSidebar navItems={navItems} actionItems={actionItems} />

      <SidebarInset style={{ scrollbarGutter: 'stable' }}>
        <Topbar
          variant="admin"
          user={user}
          onLogout={handleLogout}
          pendingCount={pendingCount}
          notifications={initialNotifications}
          notificationsUnread={initialNotificationsUnread}
        />
        <main id="main-content" tabIndex={-1} className="container max-w-5xl mx-auto px-4 py-10">
          {children}
        </main>
        <ScrollToTop />
      </SidebarInset>
    </SidebarProvider>
    </>
  )
}

export function AdminLayoutClient({
  initialUser,
  initialCredits,
  initialRequests,
  interestCount = 0,
  initialFontSize = 'normal',
  initialHighContrast = false,
  initialSpacingIncreased = false,
  initialFocusHighlight = false,
  initialExtraReducedMotion = false,
  initialNotifications = [],
  initialNotificationsUnread = 0,
  initialA11yPendingCount = 0,
  children,
}: {
  initialUser: User | null
  initialCredits: number
  initialRequests: AccessRequest[]
  interestCount?: number
  initialFontSize?: FontSize
  initialHighContrast?: boolean
  initialSpacingIncreased?: boolean
  initialFocusHighlight?: boolean
  initialExtraReducedMotion?: boolean
  initialNotifications?: Notification[]
  initialNotificationsUnread?: number
  initialA11yPendingCount?: number
  children: React.ReactNode
}) {
  return (
    <AppProvider initialUser={initialUser} initialCredits={initialCredits}>
      <AccessibilityProvider
        initialFontSize={initialFontSize}
        initialHighContrast={initialHighContrast}
        initialSpacingIncreased={initialSpacingIncreased}
        initialFocusHighlight={initialFocusHighlight}
        initialExtraReducedMotion={initialExtraReducedMotion}
      >
        <KeyboardShortcutsProvider>
          <ConsoleNotificationProvider initialRequests={initialRequests} initialA11yPendingCount={initialA11yPendingCount}>
            <AdminShell
              interestCount={interestCount}
              initialNotifications={initialNotifications}
              initialNotificationsUnread={initialNotificationsUnread}
            >
              {children}
            </AdminShell>
          </ConsoleNotificationProvider>
        </KeyboardShortcutsProvider>
      </AccessibilityProvider>
    </AppProvider>
  )
}
