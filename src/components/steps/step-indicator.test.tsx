// src/components/steps/StepIndicator.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StepIndicator } from './step-indicator'

describe('StepIndicator', () => {
  it('renders 5 steps', () => {
    render(<StepIndicator currentStep={1} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
  })

  it('marks current step as active', () => {
    render(<StepIndicator currentStep={3} />)
    expect(screen.getByLabelText('Passo atual: 3')).toBeInTheDocument()
  })
})
