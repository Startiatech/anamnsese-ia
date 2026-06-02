import { describe, it, expect, beforeAll, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
// NotificationBell (importado pela topbar) puxa server actions → supabase
vi.mock('@/server/actions/notifications', () => ({
  markNotificationAsRead: vi.fn(),
  markAllNotificationsAsRead: vi.fn(),
}))

import { Topbar } from './topbar'

// next-themes (usado pelo ThemeToggle) exige matchMedia
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

const user = { name: 'Dr. Ana Silva', initials: 'AS', email: 'ana@test.com', specialty: 'Clínica' }

describe('Topbar autenticada — full-width (avatar no canto)', () => {
  it('NÃO capa o inner (full-width): controles/avatar ficam no canto, conteúdo recua por conta própria', () => {
    // variant user + isOnboarding evita SidebarTrigger/NotificationBell (render mínimo)
    render(<Topbar variant="user" user={user} onLogout={() => {}} isOnboarding />)

    const header = screen.getByRole('banner')
    // topbar autenticada é full-width — sem cap de largura no inner
    expect(header.querySelector('.max-w-screen-2xl')).toBeNull()
    expect(header.querySelector('.max-w-7xl')).toBeNull()
  })
})
