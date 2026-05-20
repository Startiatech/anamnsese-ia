// src/components/dashboard/time-saved-card.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TimeSavedCard } from './time-saved-card'

describe('TimeSavedCard', () => {
  it('renderiza tempo em minutos quando menor que 60', () => {
    render(<TimeSavedCard minutesPerConsultation={45} todayCount={0} weekCount={1} monthCount={1} />)
    fireEvent.click(screen.getByRole('tab', { name: /semana/i }))
    expect(screen.getByText(/45min/i)).toBeInTheDocument()
  })

  it('renderiza tempo em horas e minutos quando 60+', () => {
    render(<TimeSavedCard minutesPerConsultation={45} todayCount={0} weekCount={0} monthCount={4} />)
    fireEvent.click(screen.getByRole('tab', { name: /mês/i }))
    expect(screen.getByText(/3h 0min/i)).toBeInTheDocument()
  })

  it('mostra 0min quando nao ha consultas no dia', () => {
    render(<TimeSavedCard minutesPerConsultation={45} todayCount={0} weekCount={0} monthCount={0} />)
    expect(screen.getByText(/0min/i)).toBeInTheDocument()
  })

  it('exibe contagem de consultas', () => {
    render(<TimeSavedCard minutesPerConsultation={45} todayCount={2} weekCount={5} monthCount={10} />)
    expect(screen.getByText(/2 consulta/i)).toBeInTheDocument()
  })
})
