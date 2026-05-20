import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditPatientSheet } from './edit-patient-sheet'
import type { PatientWithStats } from '@/types'

vi.mock('sonner', () => ({
  toast: { promise: vi.fn() },
}))

vi.mock('@/lib/routes', () => ({
  API: { patientId: (id: string) => `/api/patients/${id}` },
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

const patient: PatientWithStats = {
  id: 'p-1',
  name: 'Ana Lima',
  cpf: '529.982.247-25',
  birthDate: '1990-01-01',
  externalId: 'PRONT-99',
  createdAt: '2024-01-01T00:00:00Z',
  consultationCount: 2,
}

describe('EditPatientSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
  })

  it('renders patient name in title and prefills name field', () => {
    render(
      <EditPatientSheet
        open={true}
        onOpenChange={vi.fn()}
        patient={patient}
        onSuccess={vi.fn()}
      />
    )
    expect(screen.getByDisplayValue('Ana Lima')).toBeInTheDocument()
  })

  it('calls PATCH with correct payload on submit', async () => {
    const onSuccess = vi.fn()
    render(
      <EditPatientSheet
        open={true}
        onOpenChange={vi.fn()}
        patient={patient}
        onSuccess={onSuccess}
      />
    )
    fireEvent.submit(screen.getByRole('form'))
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/patients/p-1',
        expect.objectContaining({ method: 'PATCH' }),
      )
    })
  })

  it('prefills externalId field with existing patient value', () => {
    render(
      <EditPatientSheet
        open={true}
        onOpenChange={vi.fn()}
        patient={patient}
        onSuccess={vi.fn()}
      />
    )
    expect(screen.getByDisplayValue('PRONT-99')).toBeInTheDocument()
  })

  it('includes externalId in PATCH payload', async () => {
    render(
      <EditPatientSheet
        open={true}
        onOpenChange={vi.fn()}
        patient={patient}
        onSuccess={vi.fn()}
      />
    )
    fireEvent.submit(screen.getByRole('form'))
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.externalId).toBe('PRONT-99')
  })
})
