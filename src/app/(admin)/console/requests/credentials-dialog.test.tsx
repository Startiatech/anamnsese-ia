import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CredentialsDialog } from './credentials-dialog'

describe('CredentialsDialog', () => {
  it('exposes the copy button with accessible label and appropriate touch target size', () => {
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

  it('displays copy button with a touch-friendly size (h-11 minimum)', () => {
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
    expect(copyButton).toHaveClass('h-11')
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
