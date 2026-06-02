'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, Check, CheckCheck, Sparkles, Info, AlertTriangle, Gift } from 'lucide-react'
import { markNotificationAsRead, markAllNotificationsAsRead } from '@/server/actions/notifications'
import type { Notification, NotificationType } from '@/server/repositories/notifications'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'

const TYPE_ICON: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  info: Info,
  feature: Sparkles,
  warning: AlertTriangle,
  credit_injected: Gift,
}

const TYPE_COLOR: Record<NotificationType, string> = {
  info: 'text-sky-400',
  feature: 'text-violet-400',
  warning: 'text-amber-400',
  credit_injected: 'text-emerald-400',
}

function formatRelative(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diff = now - then
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `há ${days} d`
  return new Date(iso).toLocaleDateString('pt-BR')
}

interface NotificationBellProps {
  initialItems: Notification[]
  initialUnreadCount: number
}

export function NotificationBell({ initialItems, initialUnreadCount }: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>(initialItems)
  const [unreadCount, setUnreadCount] = useState<number>(initialUnreadCount)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  async function handleMarkAsRead(id: string) {
    setItems((prev) =>
      prev.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n))
    )
    setUnreadCount((c) => Math.max(0, c - 1))
    await markNotificationAsRead(id).catch(() => {})
  }

  async function handleMarkAllAsRead() {
    const nowIso = new Date().toISOString()
    setItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: nowIso })))
    setUnreadCount(0)
    await markAllNotificationsAsRead().catch(() => {})
  }

  return (
    <div ref={wrapperRef} className="relative">
      <TooltipProvider delayDuration={200}>
        <Tooltip open={open ? false : undefined}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label={`Notificações${unreadCount > 0 ? ` — ${unreadCount} não lida${unreadCount === 1 ? '' : 's'}` : ''}`}
              aria-expanded={open}
              className="relative flex items-center justify-center h-10 w-10 md:h-8 md:w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span
                  data-testid="notification-badge"
                  className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none"
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>Notificações</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {open && (
        <div
          role="dialog"
          aria-label="Lista de notificações"
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 z-50 rounded-lg border border-border bg-popover shadow-xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Notificações</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Marcar todas como lidas
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma notificação por aqui.</p>
            </div>
          ) : (
            <ul className="max-h-96 overflow-y-auto divide-y divide-border">
              {items.map((n) => {
                const Icon = TYPE_ICON[n.type]
                const colorClass = TYPE_COLOR[n.type]
                const isUnread = !n.readAt
                return (
                  <li
                    key={n.id}
                    className={cn(
                      'px-4 py-3 transition-colors',
                      isUnread && 'bg-primary/5'
                    )}
                  >
                    <div className="flex gap-3">
                      <div className={cn('shrink-0 mt-0.5', colorClass)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-foreground leading-tight">{n.title}</p>
                          <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{formatRelative(n.createdAt)}</span>
                        </div>
                        {n.body && (
                          <p className="text-xs text-muted-foreground leading-snug">{n.body}</p>
                        )}
                        <div className="flex items-center gap-3 pt-1">
                          {n.actionUrl && n.actionLabel && (
                            <Link
                              href={n.actionUrl}
                              onClick={() => { setOpen(false); if (isUnread) void handleMarkAsRead(n.id) }}
                              className="text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                            >
                              {n.actionLabel} →
                            </Link>
                          )}
                          {isUnread && (
                            <button
                              type="button"
                              onClick={() => handleMarkAsRead(n.id)}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                            >
                              <Check className="w-3 h-3" />
                              Marcar como lida
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
