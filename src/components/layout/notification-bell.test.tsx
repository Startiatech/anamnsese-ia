import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotificationBell } from './notification-bell'
import type { Notification } from '@/server/repositories/notifications'

const { mockMarkAsRead, mockMarkAllAsRead } = vi.hoisted(() => ({
  mockMarkAsRead: vi.fn(),
  mockMarkAllAsRead: vi.fn(),
}))

vi.mock('@/server/actions/notifications', () => ({
  markNotificationAsRead: mockMarkAsRead,
  markAllNotificationsAsRead: mockMarkAllAsRead,
}))

function makeItem(over: Partial<Notification> = {}): Notification {
  return {
    id: 'n1',
    userId: 'u1',
    type: 'feature',
    title: 'Nova feature',
    body: 'Descricao',
    actionUrl: null,
    actionLabel: null,
    readAt: null,
    createdAt: '2026-05-25T10:00:00Z',
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockMarkAsRead.mockResolvedValue({ ok: true })
  mockMarkAllAsRead.mockResolvedValue({ ok: true })
})

describe('NotificationBell', () => {
  it('renderiza o icone do sino', () => {
    render(<NotificationBell initialItems={[]} initialUnreadCount={0} />)
    expect(screen.getByRole('button', { name: /notifica.*es/i })).toBeTruthy()
  })

  it('exibe tooltip "Notificações" ao focar o sino', async () => {
    render(<NotificationBell initialItems={[]} initialUnreadCount={0} />)
    fireEvent.focus(screen.getByRole('button', { name: /notifica.*es/i }))
    const tooltips = await screen.findAllByText(/^Notificações$/)
    expect(tooltips.length).toBeGreaterThan(0)
  })

  it('NAO mostra badge quando unreadCount = 0', () => {
    render(<NotificationBell initialItems={[]} initialUnreadCount={0} />)
    expect(screen.queryByTestId('notification-badge')).toBeNull()
  })

  it('mostra badge com numero quando ha nao lidas', () => {
    render(<NotificationBell initialItems={[]} initialUnreadCount={3} />)
    expect(screen.getByTestId('notification-badge').textContent).toBe('3')
  })

  it('mostra "99+" quando unreadCount > 99', () => {
    render(<NotificationBell initialItems={[]} initialUnreadCount={150} />)
    expect(screen.getByTestId('notification-badge').textContent).toBe('99+')
  })

  it('lista comeca fechada', () => {
    render(<NotificationBell initialItems={[makeItem()]} initialUnreadCount={1} />)
    expect(screen.queryByText(/nova feature/i)).toBeNull()
  })

  it('clicar no sino abre a lista de notificacoes', async () => {
    const user = userEvent.setup()
    render(<NotificationBell initialItems={[makeItem()]} initialUnreadCount={1} />)

    await user.click(screen.getByRole('button', { name: /notifica.*es/i }))

    expect(screen.getByText(/nova feature/i)).toBeTruthy()
    expect(screen.getByText(/descricao/i)).toBeTruthy()
  })

  it('mostra mensagem quando nao ha notificacoes', async () => {
    const user = userEvent.setup()
    render(<NotificationBell initialItems={[]} initialUnreadCount={0} />)

    await user.click(screen.getByRole('button', { name: /notifica.*es/i }))

    expect(screen.getByText(/nenhuma notifica/i)).toBeTruthy()
  })

  it('clicar em "Marcar como lida" chama markNotificationAsRead e decrementa badge', async () => {
    const user = userEvent.setup()
    render(<NotificationBell initialItems={[makeItem()]} initialUnreadCount={1} />)

    await user.click(screen.getByRole('button', { name: /notifica.*es/i }))
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /marcar como lida/i }))
    })

    expect(mockMarkAsRead).toHaveBeenCalledWith('n1')
    // badge desaparece (unreadCount caiu para 0)
    expect(screen.queryByTestId('notification-badge')).toBeNull()
  })

  it('clicar em "Marcar todas como lidas" chama action e zera badge', async () => {
    const user = userEvent.setup()
    render(<NotificationBell initialItems={[makeItem(), makeItem({ id: 'n2' })]} initialUnreadCount={2} />)

    await user.click(screen.getByRole('button', { name: /notifica.*es/i }))
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /marcar todas/i }))
    })

    expect(mockMarkAllAsRead).toHaveBeenCalled()
    expect(screen.queryByTestId('notification-badge')).toBeNull()
  })

  it('notificacao ja lida nao mostra botao "Marcar como lida"', async () => {
    const user = userEvent.setup()
    render(
      <NotificationBell
        initialItems={[makeItem({ readAt: '2026-05-25T11:00:00Z' })]}
        initialUnreadCount={0}
      />
    )

    await user.click(screen.getByRole('button', { name: /notifica.*es/i }))

    expect(screen.queryByRole('button', { name: /marcar como lida/i })).toBeNull()
  })

  it('renderiza botao de acao quando notificacao tem actionUrl + actionLabel', async () => {
    const user = userEvent.setup()
    render(
      <NotificationBell
        initialItems={[makeItem({ actionUrl: '/configuracoes', actionLabel: 'Conhecer' })]}
        initialUnreadCount={1}
      />
    )

    await user.click(screen.getByRole('button', { name: /notifica.*es/i }))

    const cta = screen.getByRole('link', { name: /conhecer/i })
    expect(cta.getAttribute('href')).toBe('/configuracoes')
  })
})
