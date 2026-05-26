import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Home } from 'lucide-react'
import { AppSidebar } from './sidebar'

const sidebarState = { state: 'expanded' as 'expanded' | 'collapsed', isMobile: false }

vi.mock('@/components/ui/sidebar', async () => {
  const React = await import('react')
  return {
    Sidebar: ({ children }: { children: React.ReactNode }) => <aside>{children}</aside>,
    SidebarContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SidebarFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SidebarGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SidebarGroupContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SidebarHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
    SidebarMenu: ({ children }: { children: React.ReactNode }) => <ul>{children}</ul>,
    SidebarMenuBadge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
    SidebarMenuButton: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
    SidebarMenuItem: ({ children }: { children: React.ReactNode }) => <li>{children}</li>,
    SidebarSeparator: () => <hr />,
    SidebarTrigger: (props: React.ComponentProps<'button'>) => (
      <button data-testid="sidebar-trigger" {...props} />
    ),
    useSidebar: () => ({
      state: sidebarState.state,
      isMobile: sidebarState.isMobile,
      setOpenMobile: vi.fn(),
      toggleSidebar: vi.fn(),
    }),
  }
})

const navItems = [{ href: '/app', label: 'Home', icon: Home, exact: true }]

describe('AppSidebar — header logo', () => {
  it('expandido: mostra wordmark anamnese_IA_ e não mostra ponto colorido (LogoMark)', () => {
    sidebarState.state = 'expanded'
    const { container } = render(<AppSidebar navItems={navItems} />)

    const header = container.querySelector('header')!
    expect(header.textContent).toContain('anamnese')
    expect(header.textContent).toContain('_IA_')
    // O LogoMark renderiza <svg aria-hidden="true">. No header não pode ter SVG decorativo.
    expect(header.querySelector('svg[aria-hidden="true"]')).toBeNull()
  })

  it('recolhido: mostra apenas o SidebarTrigger, sem LogoMark', () => {
    sidebarState.state = 'collapsed'
    const { container } = render(<AppSidebar navItems={navItems} />)

    const header = container.querySelector('header')!
    expect(screen.getByTestId('sidebar-trigger')).toBeInTheDocument()
    expect(header.querySelector('svg[aria-hidden="true"]')).toBeNull()
  })
})
