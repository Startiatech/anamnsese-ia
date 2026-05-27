import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWakeLock } from './use-wake-lock'

let releaseSpy: ReturnType<typeof vi.fn>
let requestSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  releaseSpy = vi.fn().mockResolvedValue(undefined)
  requestSpy = vi.fn().mockResolvedValue({ release: releaseSpy, released: false })
  vi.stubGlobal('navigator', { wakeLock: { request: requestSpy } })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useWakeLock', () => {
  it('requests a screen wake lock on acquire', async () => {
    const { result } = renderHook(() => useWakeLock())
    await act(async () => { await result.current.acquire() })
    expect(requestSpy).toHaveBeenCalledWith('screen')
  })

  it('releases the wake lock on release', async () => {
    const { result } = renderHook(() => useWakeLock())
    await act(async () => { await result.current.acquire() })
    await act(async () => { await result.current.release() })
    expect(releaseSpy).toHaveBeenCalledTimes(1)
  })

  it('releases the wake lock on unmount', async () => {
    const { result, unmount } = renderHook(() => useWakeLock())
    await act(async () => { await result.current.acquire() })
    unmount()
    expect(releaseSpy).toHaveBeenCalled()
  })

  it('does not throw when wakeLock API is unavailable', async () => {
    vi.stubGlobal('navigator', {})
    const { result } = renderHook(() => useWakeLock())
    await expect(result.current.acquire()).resolves.toBeUndefined()
  })
})
