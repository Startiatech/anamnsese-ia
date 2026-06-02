'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { LogOut } from 'lucide-react'
import { AppProvider, useApp } from '@/context/app-context'
import { AccessibilityProvider, type FontSize } from '@/context/accessibility-context'
import type { Notification } from '@/server/repositories/notifications'
import { KeyboardShortcutsProvider } from '@/components/ui/keyboard-shortcuts-modal'
import { SkipLink } from '@/components/ui/skip-link'
import { AppSidebar } from '@/components/layout/sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { SidebarCredits } from '@/components/layout/sidebar-credits'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'
import { Separator } from '@/components/ui/separator'
import { Topbar } from '@/components/layout/topbar'
import { LayoutDashboard, Stethoscope, ClipboardList, CreditCard } from 'lucide-react'
import { ScrollToTop } from '@/components/ui/scroll-to-top'
import { DeletionBanner } from '@/components/layout/deletion-banner'
import { PinTempBanner } from '@/components/layout/pin-temp-banner'
import { CreditInjectedModal } from '@/components/notifications/credit-injected-modal'
import { VisibilityRefresh } from '@/components/system/visibility-refresh'
import { LAYOUT_MAX_W } from '@/lib/layout'
import type { User } from '@/types'

const NAV_ITEMS = [
  { href: '/app/dashboard',    label: 'Dashboard',  icon: LayoutDashboard, exact: true },
  { href: '/app/consultation', label: 'Atendimento', icon: Stethoscope },
  { href: '/app/history',      label: 'Histórico',   icon: ClipboardList },
  { href: '/app/plans',        label: 'Planos',      icon: CreditCard },
]

function AppShell({ children, isOnboarding, deletionScheduledAt, bonusCredits, pinIsTemp, initialNotifications, initialNotificationsUnread, creditInjectedNotification }: { children: React.ReactNode; isOnboarding: boolean; deletionScheduledAt: string | null; bonusCredits: number; pinIsTemp: boolean; initialNotifications: Notification[]; initialNotificationsUnread: number; creditInjectedNotification?: Notification | null }) {
  const { user, credits, planQuota, logout } = useApp()
  const [confirmOpen, setConfirmOpen] = useState(false)

  function handleLogoutConfirmed() {
    toast.promise(logout(), {
      loading: 'Aguarde...',
      success: 'Até logo!',
      error: 'Erro ao sair. Tente novamente.',
    })
  }

  const sidebarPreFooter = !isOnboarding ? (
    <SidebarCredits credits={credits} planQuota={planQuota} bonusCredits={bonusCredits} />
  ) : undefined

  return (
    <>
      <SkipLink />
      {confirmOpen && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="relative w-full max-w-md rounded-2xl overflow-hidden bg-card border border-violet-500/25"
          >
            <div className="flex justify-center px-6 pt-6 pb-4">
              <Logo size="sm" id="logout-modal" />
            </div>
            <Separator />
            <div className="relative px-6 pt-6 pb-4 text-center overflow-hidden">
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(139,92,246,0.10) 0%, transparent 70%)' }}
              />
              <div
                className="relative inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
                style={{ background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.3)', boxShadow: '0 0 24px rgba(139,92,246,0.15)' }}
              >
                <LogOut className="w-6 h-6 text-violet-400" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-1">Sair da conta?</h2>
              <p className="text-sm text-muted-foreground">
                Você será redirecionado para a tela de login.
              </p>
            </div>
            <div className="px-6 pb-6 flex flex-col gap-2">
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => { setConfirmOpen(false); handleLogoutConfirmed() }}
              >
                Sair
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setConfirmOpen(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <SidebarProvider>
        {!isOnboarding && (
          <AppSidebar navItems={NAV_ITEMS} preFooter={sidebarPreFooter} />
        )}

        <SidebarInset style={{ scrollbarGutter: 'stable' }}>
          <Topbar
            variant="user"
            user={user}
            onLogout={() => setConfirmOpen(true)}
            isOnboarding={isOnboarding}
            credits={credits}
            planQuota={planQuota}
            notifications={initialNotifications}
            notificationsUnread={initialNotificationsUnread}
          />
          <DeletionBanner deletionScheduledAt={deletionScheduledAt} />
          <PinTempBanner pinIsTemp={pinIsTemp} />
          <main id="main-content" tabIndex={-1} className={`container ${LAYOUT_MAX_W.content} mx-auto px-4 py-10`}>
            {children}
          </main>
          <ScrollToTop />
        </SidebarInset>
      </SidebarProvider>
      {creditInjectedNotification && (
        <CreditInjectedModal
          notificationId={creditInjectedNotification.id}
          title={creditInjectedNotification.title}
          body={creditInjectedNotification.body}
        />
      )}
      <VisibilityRefresh />
    </>
  )
}

export function AppLayoutClient({
  initialUser,
  initialCredits,
  initialPlanQuota,
  isOnboarding,
  deletionScheduledAt,
  bonusCredits,
  pinIsTemp = false,
  initialFontSize = 'normal',
  initialHighContrast = false,
  initialSpacingIncreased = false,
  initialFocusHighlight = false,
  initialExtraReducedMotion = false,
  initialNotifications = [],
  initialNotificationsUnread = 0,
  creditInjectedNotification = null,
  children,
}: {
  initialUser: User | null
  initialCredits: number
  initialPlanQuota: number
  isOnboarding: boolean
  deletionScheduledAt: string | null
  bonusCredits: number
  pinIsTemp?: boolean
  initialFontSize?: FontSize
  initialHighContrast?: boolean
  initialSpacingIncreased?: boolean
  initialFocusHighlight?: boolean
  initialExtraReducedMotion?: boolean
  initialNotifications?: Notification[]
  initialNotificationsUnread?: number
  creditInjectedNotification?: Notification | null
  children: React.ReactNode
}) {
  return (
    <AppProvider initialUser={initialUser} initialCredits={initialCredits} initialPlanQuota={initialPlanQuota}>
      <AccessibilityProvider
        initialFontSize={initialFontSize}
        initialHighContrast={initialHighContrast}
        initialSpacingIncreased={initialSpacingIncreased}
        initialFocusHighlight={initialFocusHighlight}
        initialExtraReducedMotion={initialExtraReducedMotion}
      >
        <KeyboardShortcutsProvider>
          <AppShell
            isOnboarding={isOnboarding}
            deletionScheduledAt={deletionScheduledAt}
            bonusCredits={bonusCredits}
            pinIsTemp={pinIsTemp}
            initialNotifications={initialNotifications}
            initialNotificationsUnread={initialNotificationsUnread}
            creditInjectedNotification={creditInjectedNotification}
          >
            {children}
          </AppShell>
        </KeyboardShortcutsProvider>
      </AccessibilityProvider>
    </AppProvider>
  )
}
