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
}

const ConsoleNotificationContext = createContext<ConsoleNotificationContextValue | null>(null)

const POLL_INTERVAL = 30_000

export function ConsoleNotificationProvider({
  initialRequests = [],
  children,
}: {
  initialRequests?: AccessRequest[]
  children: React.ReactNode
}) {
  const [requests, setRequests] = useState<AccessRequest[]>(initialRequests)
  const prevPendingCount = useRef(initialRequests.filter((r) => r.status === 'pending').length)

  const syncRequests = useCallback((fresh: AccessRequest[]) => {
    const newPending = fresh.filter((r) => r.status === 'pending').length
    if (newPending > prevPendingCount.current) {
      toast.info(`${newPending - prevPendingCount.current} nova(s) solicitação(ões) pendente(s)`)
    }
    prevPendingCount.current = newPending
    setRequests(fresh)
  }, [])

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/requests')
        if (!res.ok) return
        const { requests: fresh } = await res.json() as { requests: AccessRequest[] }
        const newPending = fresh.filter((r) => r.status === 'pending').length
        if (newPending > prevPendingCount.current) {
          toast.info(`${newPending - prevPendingCount.current} nova(s) solicitação(ões) pendente(s)`)
        }
        prevPendingCount.current = newPending
        setRequests(fresh)
      } catch { /* silencioso */ }
    }, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  const pendingCount = requests.filter((r) => r.status === 'pending').length

  return (
    <ConsoleNotificationContext.Provider value={{ requests, setRequests, syncRequests, pendingCount }}>
      {children}
    </ConsoleNotificationContext.Provider>
  )
}

export function useConsoleNotification() {
  const ctx = useContext(ConsoleNotificationContext)
  if (!ctx) throw new Error('useConsoleNotification must be used within ConsoleNotificationProvider')
  return ctx
}
