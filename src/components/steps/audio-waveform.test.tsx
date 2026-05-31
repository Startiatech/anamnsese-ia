import { describe, it, expect, vi, afterEach } from 'vitest'
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

  it('cancela o requestAnimationFrame no unmount', () => {
    const fakeCtx = {
      clearRect: vi.fn(),
      createLinearGradient: () => ({ addColorStop: vi.fn() }),
      fillRect: vi.fn(),
      scale: vi.fn(),
      set fillStyle(_v: unknown) {},
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      fakeCtx as unknown as CanvasRenderingContext2D,
    )
    const raf = vi.fn(() => 1)
    const caf = vi.fn()
    vi.stubGlobal('requestAnimationFrame', raf)
    vi.stubGlobal('cancelAnimationFrame', caf)
    const { unmount } = render(<AudioWaveform level={0.5} variant="recording" />)
    unmount()
    expect(caf).toHaveBeenCalled()
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
