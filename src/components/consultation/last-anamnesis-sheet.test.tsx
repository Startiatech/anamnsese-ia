import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { LastAnamnesisSheet } from './last-anamnesis-sheet'

vi.mock('@/server/actions/consultation', () => ({
  getLatestConsultation: vi.fn(),
}))

import { getLatestConsultation } from '@/server/actions/consultation'

const mockGetLatestConsultation = vi.mocked(getLatestConsultation)

const patient = { id: 'p-1', name: 'Ana Lima' }

const consultation = {
  id: 'c-1',
  rawTranscript: '',
  structuredAnamnesis: {
    sections: [{ title: 'Subjetivo (S)', content: 'Dor de cabeça há 2 dias.' }],
  },
  createdAt: '2024-03-01T10:00:00Z',
  updatedAt: '2024-03-01T10:00:00Z',
}

describe('LastAnamnesisSheet', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches and displays anamnesis sections when open', async () => {
    mockGetLatestConsultation.mockResolvedValue(consultation)
    render(<LastAnamnesisSheet open={true} onOpenChange={vi.fn()} patient={patient} userId="u-1" />)
    await waitFor(() => {
      expect(screen.getByText('Subjetivo (S)')).toBeInTheDocument()
      expect(screen.getByText('Dor de cabeça há 2 dias.')).toBeInTheDocument()
    })
  })

  it('shows empty state when no consultation found', async () => {
    mockGetLatestConsultation.mockResolvedValue(null)
    render(<LastAnamnesisSheet open={true} onOpenChange={vi.fn()} patient={patient} userId="u-1" />)
    await waitFor(() => {
      expect(screen.getByText(/nenhuma anamnese/i)).toBeInTheDocument()
    })
  })
})
