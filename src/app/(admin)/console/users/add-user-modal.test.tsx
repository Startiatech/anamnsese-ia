// @vitest-environment jsdom
import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/schemas', () => ({
  createUserSchema: {
    _def: { typeName: 'ZodObject' },
    parse: vi.fn(),
    safeParse: vi.fn(),
  },
}))

import { AddUserModal } from './add-user-modal'

describe('AddUserModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders when open', () => {
    render(<AddUserModal open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    const { container } = render(<AddUserModal open={false} onClose={vi.fn()} onSuccess={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows Novo usuário heading', () => {
    render(<AddUserModal open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)
    expect(screen.getByText('Novo usuário')).toBeInTheDocument()
  })

  it('campos têm autocomplete="off" (admin cria outro usuário — não autofillar dados do admin)', () => {
    render(<AddUserModal open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)
    for (const label of [/nome completo/i, /email/i, /especialidade/i, /whatsapp/i]) {
      expect(screen.getByLabelText(label).getAttribute('autocomplete')).toBe('off')
    }
  })
})
