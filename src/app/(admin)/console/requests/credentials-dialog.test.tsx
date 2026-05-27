import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CredentialsDialog } from './credentials-dialog'

describe('CredentialsDialog', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  it('exposes the copy button with accessible label', () => {
    render(
      <CredentialsDialog
        open
        onOpenChange={() => {}}
        name="Maria Teste"
        email="maria@x.com"
        phone="(32) 90000-0000"
        password="abc12345"
      />,
    )
    const copyButton = screen.getByRole('button', { name: /copiar/i })
    expect(copyButton).toBeInTheDocument()
    expect(copyButton).toHaveAttribute('aria-label', 'Copiar senha')
  })

  it('toggles button label from "Copiar" to "Copiado" after click', async () => {
    const user = userEvent.setup()
    render(
      <CredentialsDialog
        open
        onOpenChange={() => {}}
        name="Maria Teste"
        email="maria@x.com"
        phone="(32) 90000-0000"
        password="abc12345"
      />,
    )
    const copyButton = screen.getByRole('button', { name: /copiar senha/i })
    expect(copyButton).toHaveTextContent('Copiar')
    await user.click(copyButton)
    expect(copyButton).toHaveTextContent('Copiado')
  })

  it('renders the password in a clickable code block', () => {
    render(
      <CredentialsDialog
        open
        onOpenChange={() => {}}
        name="Maria Teste"
        email="maria@x.com"
        phone="(32) 90000-0000"
        password="abc12345"
      />,
    )
    const codeBlock = screen.getByText('abc12345')
    expect(codeBlock.tagName).toBe('CODE')
  })
})
