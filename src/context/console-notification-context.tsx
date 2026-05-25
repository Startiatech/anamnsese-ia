'use client'

import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import type { AccessRequest } from '@/lib/types'

interface ConsoleNotificationContextValue {
  requests: AccessRequest[]
  /** Use when mutating individual items (approve/reject) */
  setRequests: React.Dispatch<React.SetStateAction<AccessRequest[]>>
  /** Use when syncing a full fresh list — also updates the polling baseline */
  syncRequests: (fresh: AccessRequest[]) => void
  pendingCount: number
  /** Pedidos pendentes de acessibilidade — alimenta badge do item "Feedbacks" */
  a11yPendingCount: number
  /** Atualiza contagem a11y sem disparar toast (use apos mark/archive local) */
  syncA11yCount: (fresh: number) => void
}

const ConsoleNotificationContext = createContext<ConsoleNotificationContextValue | null>(null)

const POLL_INTERVAL = 30_000

export function ConsoleNotificationProvider({
  initialRequests = [],
  initialA11yPendingCount = 0,
  children,
}: {
  initialRequests?: AccessRequest[]
  initialA11yPendingCount?: number
  children: React.ReactNode
}) {
  const [requests, setRequests] = useState<AccessRequest[]>(initialRequests)
  const [a11yPendingCount, setA11yPendingCount] = useState<number>(initialA11yPendingCount)
  const prevPendingCount = useRef(initialRequests.filter((r) => r.status === 'pending').length)
  const prevA11yCount = useRef(initialA11yPendingCount)

  const syncRequests = useCallback((fresh: AccessRequest[]) => {
    const newPending = fresh.filter((r) => r.status === 'pending').length
    if (newPending > prevPendingCount.current) {
      toast.info(`${newPending - prevPendingCount.current} nova(s) solicitação(ões) pendente(s)`)
    }
    prevPendingCount.current = newPending
    setRequests(fresh)
  }, [])

  const syncA11yCount = useCallback((fresh: number) => {
    prevA11yCount.current = fresh
    setA11yPendingCount(fresh)
  }, [])

  useEffect(() => {
    const interval = setInterval(async () => {
      // 1. Polling de solicitacoes
      try {
        const res = await fetch('/api/requests')
        if (res.ok) {
          const { requests: fresh } = await res.json() as { requests: AccessRequest[] }
          const newPending = fresh.filter((r) => r.status === 'pending').length
          if (newPending > prevPendingCount.current) {
            toast.info(`${newPending - prevPendingCount.current} nova(s) solicitação(ões) pendente(s)`)
          }
          prevPendingCount.current = newPending
          setRequests(fresh)
        }
      } catch { /* silencioso */ }

      // 2. Polling de pedidos de acessibilidade (so contagem — lista vive na pagina)
      try {
        const res = await fetch('/api/admin/accessibility-requests/count')
        if (res.ok) {
          const { count } = await res.json() as { count: number }
          if (count > prevA11yCount.current) {
            toast.info(`${count - prevA11yCount.current} novo(s) pedido(s) de acessibilidade`)
          }
          prevA11yCount.current = count
          setA11yPendingCount(count)
        }
      } catch { /* silencioso */ }
    }, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  const pendingCount = requests.filter((r) => r.status === 'pending').length

  return (
    <ConsoleNotificationContext.Provider value={{
      requests,
      setRequests,
      syncRequests,
      pendingCount,
      a11yPendingCount,
      syncA11yCount,
    }}>
      {children}
    </ConsoleNotificationContext.Provider>
  )
}

export function useConsoleNotification() {
  const ctx = useContext(ConsoleNotificationContext)
  if (!ctx) throw new Error('useConsoleNotification must be used within ConsoleNotificationProvider')
  return ctx
}
