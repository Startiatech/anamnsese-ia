'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Dispara router.refresh() quando a aba volta a ficar visivel.
 *
 * Permite que dados server-side (creditos, notifications, etc.) sejam
 * atualizados quando o usuario volta a aba sem precisar de F5 manual,
 * sem o custo de polling ou websocket.
 */
export function VisibilityRefresh() {
  const router = useRouter()

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        router.refresh()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [router])

  return null
}
