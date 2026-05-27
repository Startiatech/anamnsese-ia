import { useCallback, useEffect, useRef } from 'react'

interface WakeLockSentinelLike {
  release: () => Promise<void>
  released: boolean
}

export function useWakeLock() {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null)
  const wantLockRef = useRef(false)

  const acquire = useCallback(async () => {
    wantLockRef.current = true
    const wl = (navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> }
    }).wakeLock
    if (!wl) return // degradação graciosa
    try {
      sentinelRef.current = await wl.request('screen')
    } catch {
      // Falha silenciosa: a rede de seguranca de interrupcao assume.
    }
  }, [])

  const release = useCallback(async () => {
    wantLockRef.current = false
    if (sentinelRef.current) {
      try { await sentinelRef.current.release() } catch { /* noop */ }
      sentinelRef.current = null
    }
  }, [])

  // Re-adquire ao voltar de segundo plano se ainda quisermos o lock.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && wantLockRef.current) {
        void acquire()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      if (sentinelRef.current) {
        void sentinelRef.current.release().catch(() => {})
        sentinelRef.current = null
      }
    }
  }, [acquire])

  return { acquire, release }
}
