'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LucideIcon } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  exact?: boolean
  badge?: number
}

export interface ActionItem {
  label: string
  icon: LucideIcon
  onClick: () => void
  className?: string
}

interface AppSidebarProps {
  navItems: NavItem[]
  actionItems?: ActionItem[]
  preFooter?: React.ReactNode
  footer?: React.ReactNode
}

export function AppSidebar({ navItems, actionItems, preFooter, footer }: AppSidebarProps) {
  const pathname = usePathname()
  const { state, isMobile, setOpenMobile, toggleSidebar } = useSidebar()
  const isCollapsed = state === 'collapsed' && !isMobile

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="flex flex-row items-center gap-2 px-2 h-16 border-b border-sidebar-border">
        {/* Wordmark anamnese_IA_ — visível apenas quando expandido */}
        <div className={cn(
          'overflow-hidden whitespace-nowrap transition-all duration-200 ease-linear',
          isCollapsed ? 'max-w-0 opacity-0 pointer-events-none' : 'max-w-[200px] opacity-100 px-2'
        )}>
          <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: '14px', letterSpacing: '-0.3px', color: 'var(--logo-text-color)', fontWeight: 400 }}>anamnese</span>
          <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: '14px', fontWeight: 700, letterSpacing: '0.5px', background: 'linear-gradient(90deg, var(--logo-from-color), var(--logo-to-color))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>_IA_</span>
        </div>

        {/* Trigger — quando recolhido, ocupa o header todo; quando expandido, fica à direita */}
        {!isMobile && (
          <SidebarTrigger className={cn('shrink-0', isCollapsed ? 'mx-auto' : 'ml-auto')} />
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(({ href, label, icon: Icon, exact, badge }) => {
                const active = exact
                  ? pathname === href
                  : pathname === href || pathname.startsWith(href + '/')
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={label}
                      onClick={isMobile ? () => setOpenMobile(false) : undefined}
                    >
                      <Link href={href}>
                        <Icon />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                    {badge != null && badge > 0 && (
                      <SidebarMenuBadge className="bg-amber-500/20 border border-amber-500/40 text-amber-600 dark:text-amber-400 text-[10px]">
                        {badge > 99 ? '99+' : badge}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {actionItems && actionItems.length > 0 && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {actionItems.map(({ label, icon: Icon, onClick, className }) => (
                    <SidebarMenuItem key={label}>
                      <SidebarMenuButton onClick={onClick} tooltip={label} className={className}>
                        <Icon />
                        <span>{label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter>
        {preFooter && <div className={state === 'collapsed' ? 'pb-1' : 'px-2 pb-1'}>{preFooter}</div>}
        {footer && <div className={state === 'collapsed' ? 'py-2 border-t border-border' : 'px-2 py-2 border-t border-border'}>{footer}</div>}
      </SidebarFooter>
    </Sidebar>
  )
}
