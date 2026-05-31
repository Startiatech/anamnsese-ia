import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AudioWaveform } from './audio-waveform'

describe('AudioWaveform', () => {
  it('renderiza um canvas com label acessível', () => {
    render(<AudioWaveform level={0.3} variant="recording" />)
    expect(screen.getByLabelText(/visualizador de áudio/i)).toBeInTheDocument()
  })

  it('expõe o estado atual via data-variant (recording)', () => {
    render(<AudioWaveform level={0.3} variant="recording" />)
    expect(screen.getByTestId('audio-waveform')).toHaveAttribute('data-variant', 'recording')
  })

  it('expõe data-variant silence', () => {
    render(<AudioWaveform level={0} variant="silence" />)
    expect(screen.getByTestId('audio-waveform')).toHaveAttribute('data-variant', 'silence')
  })

  it('expõe data-variant paused', () => {
    render(<AudioWaveform level={0} variant="paused" />)
    expect(screen.getByTestId('audio-waveform')).toHaveAttribute('data-variant', 'paused')
  })

  it('não quebra quando o contexto 2d do canvas é nulo (jsdom)', () => {
    expect(() => render(<AudioWaveform level={0.5} variant="recording" />)).not.toThrow()
  })

  it('canvas usa largura fluida (w-full) para responsividade', () => {
    render(<AudioWaveform level={0.3} variant="recording" />)
    expect(screen.getByLabelText(/visualizador de áudio/i)).toHaveClass('w-full')
  })
})
