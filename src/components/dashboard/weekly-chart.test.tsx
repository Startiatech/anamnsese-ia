import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WeeklyChart } from './weekly-chart'
import type { Consultation } from '@/types'

// Fix "today" to a known Wednesday (2026-03-25) so the week is deterministic.
// Mon 2026-03-23 … Sun 2026-03-29
beforeAll(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-03-25T10:00:00'))
})

function makeConsultation(dateStr: string): Consultation {
  return {
    id: dateStr,
    patientId: 'p1',
    status: 'completed',
    createdAt: dateStr,
    updatedAt: dateStr,
    sections: [],
    structuredAnamnesis: null,
    transcription: null,
    audioUrl: null,
  } as unknown as Consultation
}

describe('WeeklyChart', () => {
  it('renders exactly 7 day bars', () => {
    render(<WeeklyChart consultations={[]} />)
    const dayColumns = screen.getAllByTestId(/^day-col-/)
    expect(dayColumns).toHaveLength(7)
  })

  it('renders the correct day labels Mon through Sun', () => {
    render(<WeeklyChart consultations={[]} />)
    const labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
    labels.forEach((label) => {
      expect(screen.getByText(label)).toBeTruthy()
    })
  })

  it('shows count label for a day that has consultations', () => {
    // 2026-03-23 is Monday of the fixed week
    const consultations = [
      makeConsultation('2026-03-23T09:00:00'),
      makeConsultation('2026-03-23T14:00:00'),
    ]
    render(<WeeklyChart consultations={consultations} />)
    // The count badge for Monday should show "2"
    expect(screen.getByTestId('day-count-0').textContent).toBe('2')
  })

  it('shows 0 count label for empty days', () => {
    render(<WeeklyChart consultations={[]} />)
    const countEl = screen.getByTestId('day-count-0')
    expect(countEl.textContent).toBe('0')
  })
})
