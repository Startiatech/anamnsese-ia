import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRecordingInterruption } from './use-recording-interruption'

class FakeTrack {
  onended: (() => void) | null = null
  listeners: Record<string, (() => void)[]> = {}
  addEventListener(ev: string, cb: () => void) {
    (this.listeners[ev] ??= []).push(cb)
  }
  removeEventListener() {}
  fireEnded() { this.listeners['ended']?.forEach(cb => cb()) }
}

function fakeStream(track: FakeTrack): MediaStream {
  return { getAudioTracks: () => [track] } as unknown as MediaStream
}

let visibility = 'visible'

beforeEach(() => {
  visibility = 'visible'
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  })
})

afterEach(() => { vi.restoreAllMocks() })

describe('useRecordingInterruption', () => {
  it('reports "suspended" when track ends after a recent hidden event', () => {
    const onInterrupt = vi.fn()
    const track = new FakeTrack()
    renderHook(() =>
      useRecordingInterruption({ stream: fakeStream(track), active: true, onInterrupt }),
    )

    visibility = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    track.fireEnded()

    expect(onInterrupt).toHaveBeenCalledWith('suspended')
  })

  it('reports "mic-disconnected" when track ends without a hidden event', () => {
    const onInterrupt = vi.fn()
    const track = new FakeTrack()
    renderHook(() =>
      useRecordingInterruption({ stream: fakeStream(track), active: true, onInterrupt }),
    )
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
})
