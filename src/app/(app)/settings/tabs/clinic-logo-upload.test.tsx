import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ClinicLogoUpload } from './clinic-logo-upload'

global.fetch = vi.fn() as unknown as typeof fetch

describe('ClinicLogoUpload', () => {
  it('mostra preview quando logoUrl inicial existe', () => {
    render(<ClinicLogoUpload value="https://x/a.png" onChange={() => {}} />)
    const img = screen.getByAltText(/logo/i) as HTMLImageElement
    expect(img.src).toContain('https://x/a.png')
  })

  it('rejeita arquivo nao imagem antes do upload', async () => {
    const onChange = vi.fn()
    render(<ClinicLogoUpload value={null} onChange={onChange} />)
    const input = screen.getByTestId('logo-file-input') as HTMLInputElement
    const txt = new File(['x'], 'a.txt', { type: 'text/plain' })
    Object.defineProperty(input, 'files', { value: [txt] })
    fireEvent.change(input)
    await waitFor(() => expect(onChange).not.toHaveBeenCalled())
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('rejeita arquivo > 2MB antes do upload', async () => {
    const onChange = vi.fn()
    render(<ClinicLogoUpload value={null} onChange={onChange} />)
    const input = screen.getByTestId('logo-file-input') as HTMLInputElement
    const big = new File([new Uint8Array(2*1024*1024 + 1)], 'big.png', { type: 'image/png' })
    Object.defineProperty(input, 'files', { value: [big] })
    fireEvent.change(input)
    await waitFor(() => expect(onChange).not.toHaveBeenCalled())
  })

  it('upload valido chama POST e propaga url', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true, json: async () => ({ url: 'https://x/y.png', path: 'u/1.png' }),
    })
    const onChange = vi.fn()
    render(<ClinicLogoUpload value={null} onChange={onChange} />)
    const input = screen.getByTestId('logo-file-input') as HTMLInputElement
    const ok = new File([new Uint8Array(100)], 'a.png', { type: 'image/png' })
    Object.defineProperty(input, 'files', { value: [ok] })
    fireEvent.change(input)
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('https://x/y.png'))
  })

  it('remover chama DELETE e zera value', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true, status: 204 })
    const onChange = vi.fn()
    render(<ClinicLogoUpload value="https://x/a.png" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /remover/i }))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(null))
  })
})
