import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAudioLevel } from './use-audio-level'

function makeFakeAnalyser(sampleValue: number) {
  return {
    fftSize: 0,
    frequencyBinCount: 16,
    getByteTimeDomainData: (data: Uint8Array) => {
      data.fill(sampleValue)
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
}

function stubAudioContext(sampleValue: number) {
  const analyser = makeFakeAnalyser(sampleValue)
  const closeSpy = vi.fn(() => Promise.resolve())
  class FakeAudioContext {
    createMediaStreamSource() { return { connect: vi.fn(), disconnect: vi.fn() } }
    createAnalyser() { return analyser }
    close = closeSpy
  }
  vi.stubGlobal('AudioContext', FakeAudioContext)
  return { analyser, closeSpy }
}

const fakeStream = { } as unknown as MediaStream

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useAudioLevel', () => {
  it('reporta nível ~0 quando o áudio está no centro (silêncio)', () => {
    vi.useFakeTimers()
    const { analyser: _a } = stubAudioContext(128)
    const onLevel = vi.fn()
    renderHook(() => useAudioLevel({ stream: fakeStream, active: true, onLevel }))
    vi.advanceTimersByTime(200)
    expect(onLevel).toHaveBeenCalled()
    const last = onLevel.mock.calls.at(-1)![0] as number
    expect(last).toBeCloseTo(0, 2)
  })

  it('reporta nível > 0 quando há sinal de áudio', () => {
    vi.useFakeTimers()
    const { analyser: _b } = stubAudioContext(200)
    const onLevel = vi.fn()
    renderHook(() => useAudioLevel({ stream: fakeStream, active: true, onLevel }))
    vi.advanceTimersByTime(200)
    const last = onLevel.mock.calls.at(-1)![0] as number
    expect(last).toBeGreaterThan(0.1)
  })

  it('não reporta quando inativo', () => {
    vi.useFakeTimers()
    const { analyser: _c } = stubAudioContext(200)
    const onLevel = vi.fn()
    renderHook(() => useAudioLevel({ stream: fakeStream, active: false, onLevel }))
    vi.advanceTimersByTime(500)
    expect(onLevel).not.toHaveBeenCalled()
  })

  it('degrada graciosamente quando AudioContext não existe', () => {
    vi.useFakeTimers()
    vi.stubGlobal('AudioContext', undefined)
    const onLevel = vi.fn()
    expect(() =>
      renderHook(() => useAudioLevel({ stream: fakeStream, active: true, onLevel })),
    ).not.toThrow()
    vi.advanceTimersByTime(500)
    expect(onLevel).not.toHaveBeenCalled()
  })

  it('não reporta quando stream é null', () => {
    vi.useFakeTimers()
    stubAudioContext(200)
    const onLevel = vi.fn()
    renderHook(() => useAudioLevel({ stream: null, active: true, onLevel }))
    vi.advanceTimersByTime(500)
    expect(onLevel).not.toHaveBeenCalled()
  })

  it('limpa o AudioContext no unmount', () => {
    vi.useFakeTimers()
    const { analyser, closeSpy } = stubAudioContext(200)
    const onLevel = vi.fn()
    const { unmount } = renderHook(() =>
      useAudioLevel({ stream: fakeStream, active: true, onLevel }),
    )
    unmount()
    expect(analyser.disconnect).toHaveBeenCalled()
    expect(closeSpy).toHaveBeenCalled()
  })
})
