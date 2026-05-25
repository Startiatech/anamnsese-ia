import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CompleteConfirmDialog } from './complete-confirm-dialog'

describe('CompleteConfirmDialog', () => {
  it('nao renderiza conteudo quando open=false', () => {
    render(
      <CompleteConfirmDialog open={false} onOpenChange={() => {}} onConfirm={() => {}} />
    )
    expect(screen.queryByText(/finalizar atendimento\?/i)).toBeNull()
  })

  it('renderiza titulo, descricao e opcoes quando open=true', () => {
    render(
      <CompleteConfirmDialog open={true} onOpenChange={() => {}} onConfirm={() => {}} />
    )
    expect(screen.getByText(/finalizar atendimento\?/i)).toBeTruthy()
    expect(screen.getByText(/anamnese ser. salva/i)).toBeTruthy()
    expect(screen.getByText(/n.o pode ser desfeita/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /revisar antes/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^finalizar$/i })).toBeTruthy()
  })

  it('clicar em "Finalizar" dispara onConfirm', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()

    render(
      <CompleteConfirmDialog open={true} onOpenChange={() => {}} onConfirm={onConfirm} />
    )

    await user.click(screen.getByRole('button', { name: /^finalizar$/i }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('clicar em "Revisar antes" fecha o dialogo (onOpenChange(false))', async () => {
    const onOpenChange = vi.fn()
    const onConfirm = vi.fn()
    const user = userEvent.setup()

    render(
      <CompleteConfirmDialog open={true} onOpenChange={onOpenChange} onConfirm={onConfirm} />
    )

    await user.click(screen.getByRole('button', { name: /revisar antes/i }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
