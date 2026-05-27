import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RequestsClient } from './requests-client'
import { ConsoleNotificationProvider } from '@/context/console-notification-context'
import type { AccessRequest } from '@/lib/types'

vi.mock('@/components/console/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}))

function pendingRequest(): AccessRequest {
  return {
    id: 'r1', name: 'Maria Teste', email: 'maria@x.com', specialty: 'Cardio',
    phone: '(32) 90000-0000', message: undefined, status: 'pending',
    createdAt: '2026-05-27T14:30:00.000Z', userPasswordIsTemp: false,
  } as AccessRequest
}

function renderWithProvider(requests: AccessRequest[]) {
  return render(
    <ConsoleNotificationProvider initialRequests={requests} initialA11yPendingCount={0}>
      <RequestsClient initialRequests={requests} />
    </ConsoleNotificationProvider>,
  )
}

describe('RequestsClient (responsivo)', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('renders the desktop table wrapper hidden on mobile', () => {
    const { container } = renderWithProvider([pendingRequest()])
    const tableWrapper = container.querySelector('.hidden.md\\:block')
    expect(tableWrapper).not.toBeNull()
  })

  it('renders a mobile card list hidden on desktop', () => {
    const { container } = renderWithProvider([pendingRequest()])
    const cardList = container.querySelector('.md\\:hidden')
    expect(cardList).not.toBeNull()
  })

  it('approving from the mobile card triggers the create-user request', async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )
    vi.spyOn(window, 'open').mockReturnValue(null)

    renderWithProvider([pendingRequest()])

    await user.click(screen.getByRole('button', { name: /aprovar/i }))

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/admin/create-user',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
