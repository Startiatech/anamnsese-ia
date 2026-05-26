'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react'
import type { User } from '@/types'

interface AppContextValue {
  user: User | null
  credits: number
  planQuota: number
  refreshCredits: () => Promise<void>
  logout: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

interface AppProviderProps {
  children: ReactNode
  initialUser?: User | null
  initialCredits?: number
  initialPlanQuota?: number
}

export function AppProvider({ children, initialUser = null, initialCredits = 0, initialPlanQuota = 0 }: AppProviderProps) {
  const [user] = useState<User | null>(initialUser)
  const [credits, setCredits] = useState<number>(initialCredits)
  const [planQuota] = useState<number>(initialPlanQuota)

  // Sincroniza credits quando o layout re-renderiza com prop atualizada
  useEffect(() => {
    setCredits(initialCredits)
  }, [initialCredits])

  const refreshCredits = useCallback(async () => {
    const res = await fetch('/api/auth/me')
    if (!res.ok) return
    const data = await res.json()
    if (typeof data.credits === 'number') setCredits(data.credits)
  }, [])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <AppContext.Provider value={{ user, credits, planQuota, refreshCredits, logout }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}

