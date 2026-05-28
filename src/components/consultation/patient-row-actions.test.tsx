import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PatientRowActions } from './patient-row-actions'
import type { PatientWithStats } from '@/types'

vi.mock('./edit-patient-sheet', () => ({
  EditPatientSheet: ({ open }: { open: boolean }) =>
    open ? <div data-testid="edit-sheet" /> : null,
}))

vi.mock('./delete-patient-dialog', () => ({
  DeletePatientDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="delete-dialog" /> : null,
}))

// Radix dropdown renders in portal — mock to render children inline
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) => (
    <button onClick={onClick} className={className}>{children}</button>
  ),
  DropdownMenuSeparator: () => <hr />,
}))

function makePatient(hasAnamnesis: boolean, consultationCount = hasAnamnesis ? 1 : 0): PatientWithStats {
  return {
    id: 'p-1',
    name: 'Ana Lima',
    cpf: '123.456.789-00',
    createdAt: '2024-01-01T00:00:00Z',
    consultationCount,
    hasAnamnesis,
  }
}

describe('PatientRowActions', () => {
  const onUpdated = vi.fn()
  const onDeleted = vi.fn()
  const onViewAnamnesis = vi.fn()

  beforeEach(() => vi.clearAllMocks())

  it('renders Editar and Excluir items when patient has no anamnesis', () => {
    render(
      <PatientRowActions
        patient={makePatient(false)}
        onUpdated={onUpdated}
        onDeleted={onDeleted}
        onViewAnamnesis={onViewAnamnesis}
      />
    )
    expect(screen.getByText('Editar')).toBeInTheDocument()
    expect(screen.getByText('Excluir')).toBeInTheDocument()
  })

  it('does NOT show "Ver última anamnese" for patient without anamnesis (mesmo com atendimento abandonado)', () => {
    render(
      <PatientRowActions
        patient={makePatient(false, 1)}
        onUpdated={onUpdated}
        onDeleted={onDeleted}
        onViewAnamnesis={onViewAnamnesis}
      />
    )
    expect(screen.queryByText('Ver última anamnese')).not.toBeInTheDocument()
  })

  it('shows "Ver última anamnese" when patient has anamnesis', () => {
    render(
      <PatientRowActions
        patient={makePatient(true)}
        onUpdated={onUpdated}
        onDeleted={onDeleted}
        onViewAnamnesis={onViewAnamnesis}
      />
    )
    expect(screen.getByText('Ver última anamnese')).toBeInTheDocument()
  })

  it('calls onViewAnamnesis when "Ver última anamnese" is clicked', () => {
    render(
      <PatientRowActions
        patient={makePatient(true)}
        onUpdated={onUpdated}
        onDeleted={onDeleted}
        onViewAnamnesis={onViewAnamnesis}
      />
    )
    fireEvent.click(screen.getByText('Ver última anamnese'))
    expect(onViewAnamnesis).toHaveBeenCalledOnce()
  })

  it('"Ver última anamnese" appears before "Excluir" in the menu', () => {
    render(
      <PatientRowActions
        patient={makePatient(true)}
        onUpdated={onUpdated}
        onDeleted={onDeleted}
        onViewAnamnesis={onViewAnamnesis}
      />
    )
    const items = screen.getAllByRole('button')
    const anamnesisIndex = items.findIndex(el => el.textContent?.includes('Ver última anamnese'))
    const excluirIndex = items.findIndex(el => el.textContent?.includes('Excluir'))
    expect(anamnesisIndex).toBeGreaterThan(-1)
    expect(excluirIndex).toBeGreaterThan(-1)
    expect(anamnesisIndex).toBeLessThan(excluirIndex)
  })
})
