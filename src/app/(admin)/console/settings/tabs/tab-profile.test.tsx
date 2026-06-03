import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TabProfile } from './tab-profile'

const { mockUpdateMasterProfile, mockToast } = vi.hoisted(() => ({
  mockUpdateMasterProfile: vi.fn(),
  mockToast: { promise: vi.fn((p: Promise<unknown>) => p) },
}))

vi.mock('@/server/actions/settings', () => ({
  updateMasterProfile: mockUpdateMasterProfile,
}))

vi.mock('sonner', () => ({ toast: mockToast }))

beforeEach(() => {
  vi.clearAllMocks()
  mockUpdateMasterProfile.mockResolvedValue({ ok: true })
})

describe('Console TabProfile — campos de perfil', () => {
  it('exibe cabeçalho do bloco com título e descrição (padrão user)', () => {
    render(<TabProfile userName="Master" userEmail="master@test.com" userPhone="" />)

    expect(screen.getByText(/^pessoais$/i)).toBeTruthy()
    expect(screen.getByText(/informações de identificação básica/i)).toBeTruthy()
  })

  it('campos têm label associado + autocomplete (a11y / DevTools)', () => {
    render(<TabProfile userName="Master" userEmail="master@test.com" userPhone="" />)

    // getByLabelText só acha o input se o <label htmlFor> estiver associado ao id
    expect(screen.getByLabelText(/nome/i).getAttribute('autocomplete')).toBe('name')
    expect(screen.getByLabelText(/telefone/i).getAttribute('autocomplete')).toBe('tel')
  })

  it('exibe o email como somente leitura (input desabilitado)', () => {
    render(<TabProfile userName="Master" userEmail="master@test.com" userPhone="" />)

    const emailInput = screen.getByDisplayValue('master@test.com') as HTMLInputElement
    expect(emailInput.disabled).toBe(true)
  })

  it('pré-preenche o telefone existente', () => {
    render(<TabProfile userName="Master" userEmail="master@test.com" userPhone="(11) 98888-7777" />)

    const phoneInput = screen.getByTestId('console-profile-phone') as HTMLInputElement
    expect(phoneInput.value).toBe('(11) 98888-7777')
  })

  it('submit chama updateMasterProfile com nome e telefone (sem email)', async () => {
    render(<TabProfile userName="Master" userEmail="master@test.com" userPhone="" />)

    fireEvent.change(screen.getByTestId('console-profile-phone'), {
      target: { value: '(11) 91234-5678' },
    })
    fireEvent.click(screen.getByRole('button', { name: /salvar alterações/i }))

    await waitFor(() => {
      expect(mockUpdateMasterProfile).toHaveBeenCalledWith({
        name: 'Master',
        phone: '(11) 91234-5678',
      })
    })
  })
})
