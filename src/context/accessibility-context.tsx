'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'

export type FontSize = 'normal' | 'large' | 'xlarge'

interface AccessibilityContextValue {
  fontSize: FontSize
  highContrast: boolean
  setFontSize: (v: FontSize) => void
  setHighContrast: (v: boolean) => void
}

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null)

const LS_FONT_KEY = 'a11y:fontSize'
const LS_CONTRAST_KEY = 'a11y:highContrast'

function applyToDom(fontSize: FontSize, highContrast: boolean) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-font-size', fontSize)
  document.documentElement.setAttribute('data-high-contrast', String(highContrast))
}

async function persistToServer(body: Record<string, unknown>) {
  try {
    await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    // falha silenciosa — localStorage e DOM ja foram atualizados,
    // proxima carga reconcilia com o estado do servidor
  }
}

interface AccessibilityProviderProps {
  children: ReactNode
  initialFontSize?: FontSize
  initialHighContrast?: boolean
}

export function AccessibilityProvider({
  children,
  initialFontSize = 'normal',
  initialHighContrast = false,
}: AccessibilityProviderProps) {
  const [fontSize, setFontSizeState] = useState<FontSize>(initialFontSize)
  const [highContrast, setHighContrastState] = useState<boolean>(initialHighContrast)

  useEffect(() => {
    applyToDom(fontSize, highContrast)
  }, [fontSize, highContrast])

  const setFontSize = useCallback((v: FontSize) => {
    setFontSizeState(v)
    try { localStorage.setItem(LS_FONT_KEY, v) } catch { /* storage indisponivel */ }
    void persistToServer({ prefFontSize: v })
  }, [])

  const setHighContrast = useCallback((v: boolean) => {
    setHighContrastState(v)
    try { localStorage.setItem(LS_CONTRAST_KEY, String(v)) } catch { /* storage indisponivel */ }
    void persistToServer({ prefHighContrast: v })
  }, [])

  return (
    <AccessibilityContext.Provider value={{ fontSize, highContrast, setFontSize, setHighContrast }}>
      {children}
    </AccessibilityContext.Provider>
  )
}

export function useAccessibility(): AccessibilityContextValue {
  const ctx = useContext(AccessibilityContext)
  if (!ctx) throw new Error('useAccessibility must be used inside <AccessibilityProvider>')
  return ctx
}
