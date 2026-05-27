import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSilenceDetection } from './use-silence-detection'

// Controla o valor de volume retornado pelo AnalyserNode mockado.
let mockVolume = 0

class FakeAnalyser {
  fftSize = 0
  frequencyBinCount = 32
  getByteTimeDomainData(arr: Uint8Array) {
    // 128 = silêncio absoluto (centro). Desvio = volume.
    const deviation = Math.round(mockVolume * 127)
    arr.fill(128 + deviation)
  }
  connect() {}
  disconnect() {}
}

class FakeAudioContext {
  createAnalyser() { return new FakeAnalyser() }
  createMediaStreamSource() { return { connect: vi.fn(), disconnect: vi.fn() } }
  close() { return Promise.resolve() }
}

beforeEach(() => {
  mockVolume = 0
  vi.stubGlobal('AudioContext', FakeAudioContext)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function fakeStream(): MediaStream {
  return { getAudioTracks: () => [{}] } as unknown as MediaStream
}

describe('useSilenceDetection', () => {
  it('calls onSilence after the silence threshold elapses', () => {
    const onSilence = vi.fn()
    const onSpeech = vi.fn()
    mockVolume = 0 // silêncio

    renderHook(() =>
      useSilenceDetection({
        stream: fakeStream(),
        active: true,
        silenceMs: 2500,
        threshold: 0.05,
        onSilence,
        onSpeech,
      }),
    )

    vi.advanceTimersByTime(3000)
    expect(onSilence).toHaveBeenCalledTimes(1)
    expect(onSpeech).not.toHaveBeenCalled()
  })

  it('calls onSpeech immediately when volume rises after silence', () => {
    const onSilence = vi.fn()
    const onSpeech = vi.fn()
    mockVolume = 0

    renderHook(() =>
      useSilenceDetection({
        stream: fakeStream(),
        active: true,
        silenceMs: 2500,
        threshold: 0.05,
        onSilence,
        onSpeech,
      }),
    )

    vi.advanceTimersByTime(3000) // entra em silêncio
    mockVolume = 0.5 // voz
    vi.advanceTimersByTime(300)
    expect(onSpeech).toHaveBeenCalledTimes(1)
  })

  it('does nothing when active is false', () => {
    const onSilence = vi.fn()
    mockVolume = 0
    renderHook(() =>
      useSilenceDetection({
        stream: fakeStream(),
        active: false,
        silenceMs: 2500,
        threshold: 0.05,
        onSilence,
        onSpeech: vi.fn(),
      }),
    )
    vi.advanceTimersByTime(3000)
    expect(onSilence).not.toHaveBeenCalled()
  })

  it('does nothing when stream is null', () => {
    const onSilence = vi.fn()
    mockVolume = 0
    renderHook(() =>
      useSilenceDetection({
        stream: null,
        active: true,
        silenceMs: 2500,
        threshold: 0.05,
        onSilence,
        onSpeech: vi.fn(),
      }),
    )
    vi.advanceTimersByTime(3000)
    expect(onSilence).not.toHaveBeenCalled()
  })
})
