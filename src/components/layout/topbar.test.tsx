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

describe('Topbar — largura máxima do conteúdo (alinha controles com o <main> capado)', () => {
  it('envolve o conteúdo num container central max-w-5xl (não cola nos cantos em telas grandes)', () => {
    // variant user + isOnboarding evita SidebarTrigger/NotificationBell (render mínimo)
    render(<Topbar variant="user" user={user} onLogout={() => {}} isOnboarding />)

    const header = screen.getByRole('banner')
    const wrapper = header.querySelector('.max-w-5xl')
    expect(wrapper).not.toBeNull()
    expect(wrapper?.className).toContain('mx-auto')
  })
})
