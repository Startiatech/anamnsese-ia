import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRecordingInterruption } from './use-recording-interruption'

class FakeTrack {
  listeners: Record<string, (() => void)[]> = {}
  addEventListener(ev: string, cb: () => void) {
    (this.listeners[ev] ??= []).push(cb)
  }
  removeEventListener(ev: string, cb: () => void) {
    this.listeners[ev] = (this.listeners[ev] ?? []).filter(f => f !== cb)
  }
  fireEnded() { this.listeners['ended']?.forEach(cb => cb()) }
}

function fakeStream(track: FakeTrack): MediaStream {
  return { getAudioTracks: () => [track] } as unknown as MediaStream
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useRecordingInterruption', () => {
  it('reports "suspended" when the event loop was frozen (clock jump)', () => {
    vi.useFakeTimers()
    const start = Date.now()
    const onInterrupt = vi.fn()
    const track = new FakeTrack()
    renderHook(() =>
      useRecordingInterruption({ stream: fakeStream(track), active: true, onInterrupt }),
    )

    // Operação normal: um tick do watchdog atualiza a referência de tempo.
    vi.advanceTimersByTime(2000)

    // Hibernação: o relógio salta 60s sem o event loop rodar (timers não avançam).
    vi.setSystemTime(start + 2000 + 60_000)

    track.fireEnded()
    expect(onInterrupt).toHaveBeenCalledWith('suspended')
  })

  it('reports "mic-disconnected" when the track ends during normal operation', () => {
    vi.useFakeTimers()
    const onInterrupt = vi.fn()
    const track = new FakeTrack()
    renderHook(() =>
      useRecordingInterruption({ stream: fakeStream(track), active: true, onInterrupt }),
    )

    vi.advanceTimersByTime(2000)
    track.fireEnded()
    expect(onInterrupt).toHaveBeenCalledWith('mic-disconnected')
  })

  it('does not fire when inactive', () => {
    const onInterrupt = vi.fn()
    const track = new FakeTrack()
    renderHook(() =>
      useRecordingInterruption({ stream: fakeStream(track), active: false, onInterrupt }),
    )
    track.fireEnded()
    expect(onInterrupt).not.toHaveBeenCalled()
  })

  it('does not fire after unmount (cleanup removes the listener)', () => {
    const onInterrupt = vi.fn()
    const track = new FakeTrack()
    const { unmount } = renderHook(() =>
      useRecordingInterruption({ stream: fakeStream(track), active: true, onInterrupt }),
    )
    unmount()
    track.fireEnded()
    expect(onInterrupt).not.toHaveBeenCalled()
  })
})
