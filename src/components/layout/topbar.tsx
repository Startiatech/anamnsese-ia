'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Zap, Bell, Settings, LogOut, ChevronDown } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { NotificationBell } from './notification-bell'
import type { Notification } from '@/server/repositories/notifications'

function useScrolled(threshold = 60) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > threshold) }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])
  return scrolled
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopbarUser {
  name: string
  initials: string
  email?: string
  specialty?: string
}

interface TopbarPublicProps {
  variant: 'public'
  right?: React.ReactNode
}

interface TopbarUserProps {
  variant: 'user'
  user: TopbarUser | null
  onLogout: () => void
  isOnboarding?: boolean
  credits?: number
  planQuota?: number
  notifications?: Notification[]
  notificationsUnread?: number
}

interface TopbarAdminProps {
  variant: 'admin'
  user: TopbarUser | null
  onLogout: () => void
  pendingCount?: number
  notifications?: Notification[]
  notificationsUnread?: number
}

type TopbarProps = TopbarPublicProps | TopbarUserProps | TopbarAdminProps

// ─── Credits chip (user mobile) ───────────────────────────────────────────────

function CreditsChip({ credits, planQuota }: { credits: number; planQuota: number }) {
  const ratio = planQuota > 0 ? credits / planQuota : 1
  const colorClass =
    ratio > 0.5
      ? 'text-emerald-400'
      : ratio > 0.2
        ? 'text-amber-400'
        : 'text-red-400'

  return (
    <div className={cn('md:hidden flex items-center gap-1 text-xs font-semibold tabular-nums', colorClass)}>
      <Zap className="w-3.5 h-3.5 shrink-0" />
      <span>{credits}</span>
    </div>
  )
}

// ─── Pending bell (admin) ─────────────────────────────────────────────────────

function PendingBell({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <Link
      href={ROUTES.consoleSolicitacoes}
      className="relative flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      aria-label={`${count} solicitações pendentes`}
    >
      <Bell className="w-4 h-4" />
      <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none">
        {count > 99 ? '99+' : count}
      </span>
    </Link>
  )
}

// ─── Avatar dropdown ──────────────────────────────────────────────────────────

function AvatarMenu({
  user,
  variant,
  onLogout,
}: {
  user: TopbarUser | null
  variant: 'user' | 'admin'
  onLogout: () => void
}) {
  const subtitle = variant === 'user' ? user?.specialty : user?.email

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
          <Avatar className="w-7 h-7 shrink-0">
            <AvatarFallback
              className="text-[11px] font-bold"
              style={{ background: 'var(--avatar-gradient)', color: 'var(--avatar-text-color)' }}
            >
              {user?.initials ?? '?'}
            </AvatarFallback>
          </Avatar>
          <div className="hidden sm:flex flex-col text-left leading-tight max-w-[140px]">
            <span className="text-sm font-medium text-foreground truncate">{user?.name ?? '—'}</span>
            {subtitle && (
              <span className="text-xs truncate" style={{ color: 'var(--subtitle-color)', opacity: 0.9 }}>{subtitle}</span>
            )}
          </div>
          <ChevronDown className="w-3 h-3 text-muted-foreground hidden sm:block shrink-0" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="font-normal py-2.5">
          <p className="text-sm font-semibold text-foreground truncate">{user?.name ?? '—'}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          )}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {variant === 'user' && (
          <DropdownMenuItem asChild>
            <Link href={ROUTES.configuracoes} className="flex items-center gap-2 cursor-pointer">
              <Settings className="w-4 h-4" />
              Configurações
            </Link>
          </DropdownMenuItem>
        )}

        {variant === 'admin' && (
          <DropdownMenuItem asChild>
            <Link href={ROUTES.consoleSettings} className="flex items-center gap-2 cursor-pointer">
              <Settings className="w-4 h-4" />
              Configurações
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={onLogout}
          className="flex items-center gap-2 text-red-400 focus:text-red-600 dark:focus:text-red-400 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── Topbar ───────────────────────────────────────────────────────────────────

const scrolledStyle = {
  background: 'var(--topbar-scrolled-bg)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  borderBottom: 'none',
  boxShadow: '0 1px 0 0 var(--topbar-scrolled-border)',
} as React.CSSProperties

const defaultStyle = {
  background: 'var(--sidebar-background)',
  backdropFilter: 'none',
  WebkitBackdropFilter: 'none',
  borderBottom: 'none',
  boxShadow: '0 1px 0 0 var(--topbar-initial-border)',
} as React.CSSProperties

export function Topbar(props: TopbarProps) {
  const { variant } = props
  const scrolled = useScrolled()
  const headerStyle = scrolled ? scrolledStyle : defaultStyle

  if (variant === 'public') {
    return (
      <header
        className="fixed top-0 left-0 right-0 h-16 z-50 transition-all duration-300 flex justify-center px-6"
        style={headerStyle}
      >
        <div className="w-full max-w-5xl flex items-center h-full gap-4">
          <Logo size="md" id="topbar" />
          <div className="flex-1" />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            {props.right && props.right}
          </div>
        </div>
      </header>
    )
  }

  const { user, onLogout } = props
  const isOnboarding = variant === 'user' ? (props.isOnboarding ?? false) : false
  const showTrigger = !isOnboarding

  return (
    <header
      className="sticky top-0 h-16 z-50 transition-all duration-300"
      style={headerStyle}
    >
      <div className="h-full flex items-center gap-3 px-4">

        {/* ── Mobile: trigger hambúrguer + logo (sidebar é Sheet no mobile) ── */}
        <div className="flex items-center gap-2 md:hidden">
          {showTrigger && <SidebarTrigger className="shrink-0" />}
          <Logo size="md" id="topbar-mobile" />
          {variant === 'admin' && (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-widest uppercase bg-primary/15 text-primary border border-primary/30">
              Admin
            </span>
          )}
        </div>

        {/* ── Desktop: logo visível apenas no onboarding (sem sidebar) ── */}
        {isOnboarding && (
          <div className="hidden md:flex items-center">
            <Logo size="md" id="topbar-desktop-onboarding" />
          </div>
        )}

        {/* ── Spacer ── */}
        <div className="flex-1" />

        {/* ── Right: extras + toggle + avatar ── */}
        <div className="flex items-center gap-2">
          {variant === 'user' && !isOnboarding && (
            <CreditsChip
              credits={props.credits ?? 0}
              planQuota={props.planQuota ?? 1}
            />
          )}
          {variant === 'admin' && (
            <PendingBell count={props.pendingCount ?? 0} />
          )}
          {!isOnboarding && (variant === 'user' || variant === 'admin') && (
            <NotificationBell
              initialItems={props.notifications ?? []}
              initialUnreadCount={props.notificationsUnread ?? 0}
            />
          )}
          <ThemeToggle />
          {!isOnboarding && (
            <AvatarMenu user={user} variant={variant} onLogout={onLogout} />
          )}
        </div>

      </div>
    </header>
  )
}
