'use client'

import Link from 'next/link'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useSidebar } from '@/components/ui/sidebar'

export interface SidebarUserFooterProps {
  initials: string
  name: string
  subtitle: string
  onLogout?: () => void
  menuItems?: { label: string; href: string }[]
}

export function SidebarUserFooter({ initials, name, subtitle, onLogout, menuItems }: SidebarUserFooterProps) {
  const { state } = useSidebar()
  const collapsed = state === 'collapsed'

  return (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={`w-full flex items-center rounded-md px-1 py-1 hover:bg-secondary transition-colors cursor-pointer ${collapsed ? 'justify-center gap-0' : 'gap-2'}`}
            aria-label="Menu do usuário"
          >
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback
                className="text-xs font-semibold"
                style={{ background: 'var(--avatar-gradient)', color: 'var(--avatar-text-color)' }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 text-left overflow-hidden">
                <p className="text-sm font-medium text-foreground leading-tight truncate">{name}</p>
                <p className="text-xs leading-tight truncate" style={{ color: 'var(--subtitle-color)', opacity: 0.9 }}>{subtitle}</p>
              </div>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-48">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium leading-none">{name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
          {menuItems && menuItems.length > 0 && (
            <>
              <DropdownMenuSeparator />
              {menuItems.map((item) => (
                <DropdownMenuItem key={item.href} asChild>
                  <Link href={item.href}>{item.label}</Link>
                </DropdownMenuItem>
              ))}
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onLogout}>
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
  )
}
