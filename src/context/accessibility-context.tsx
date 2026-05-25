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
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface AccessibilityContextValue {
  fontSize: FontSize
  highContrast: boolean
  spacingIncreased: boolean
  focusHighlight: boolean
  extraReducedMotion: boolean
  betaA11yV2: boolean
  saveStatus: SaveStatus
  setFontSize: (v: FontSize) => void
  setHighContrast: (v: boolean) => void
  setSpacingIncreased: (v: boolean) => void
  setFocusHighlight: (v: boolean) => void
  setExtraReducedMotion: (v: boolean) => void
}

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null)

const LS_FONT_KEY = 'a11y:fontSize'
const LS_CONTRAST_KEY = 'a11y:highContrast'
const LS_SPACING_KEY = 'a11y:spacingIncreased'
const LS_FOCUS_KEY = 'a11y:focusHighlight'
const LS_MOTION_KEY = 'a11y:extraReducedMotion'

function applyToDom(state: {
  fontSize: FontSize
  highContrast: boolean
  spacingIncreased: boolean
  focusHighlight: boolean
  extraReducedMotion: boolean
}) {
  if (typeof document === 'undefined') return
  const el = document.documentElement
  el.setAttribute('data-font-size', state.fontSize)
  el.setAttribute('data-high-contrast', String(state.highContrast))
  el.setAttribute('data-spacing-increased', String(state.spacingIncreased))
  el.setAttribute('data-focus-highlight', String(state.focusHighlight))
  el.setAttribute('data-extra-reduced-motion', String(state.extraReducedMotion))
}

interface AccessibilityProviderProps {
  children: ReactNode
  initialFontSize?: FontSize
  initialHighContrast?: boolean
  initialSpacingIncreased?: boolean
  initialFocusHighlight?: boolean
  initialExtraReducedMotion?: boolean
  initialBetaA11yV2?: boolean
}

export function AccessibilityProvider({
  children,
  initialFontSize = 'normal',
  initialHighContrast = false,
  initialSpacingIncreased = false,
  initialFocusHighlight = false,
  initialExtraReducedMotion = false,
  initialBetaA11yV2 = false,
}: AccessibilityProviderProps) {
  const [fontSize, setFontSizeState] = useState<FontSize>(initialFontSize)
  const [highContrast, setHighContrastState] = useState<boolean>(initialHighContrast)
  const [spacingIncreased, setSpacingIncreasedState] = useState<boolean>(initialSpacingIncreased)
  const [focusHighlight, setFocusHighlightState] = useState<boolean>(initialFocusHighlight)
  const [extraReducedMotion, setExtraReducedMotionState] = useState<boolean>(initialExtraReducedMotion)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  useEffect(() => {
    applyToDom({ fontSize, highContrast, spacingIncreased, focusHighlight, extraReducedMotion })
  }, [fontSize, highContrast, spacingIncreased, focusHighlight, extraReducedMotion])

  // Auto-clear "saved" depois de 2s para voltar a idle
  useEffect(() => {
    if (saveStatus !== 'saved') return
    const t = setTimeout(() => setSaveStatus('idle'), 2000)
    return () => clearTimeout(t)
  }, [saveStatus])

  const persist = useCallback(async (body: Record<string, unknown>) => {
    setSaveStatus('saving')
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('PATCH failed')
      setSaveStatus('saved')
    } catch {
      setSaveStatus('error')
    }
  }, [])

  const setFontSize = useCallback((v: FontSize) => {
    setFontSizeState(v)
    try { localStorage.setItem(LS_FONT_KEY, v) } catch { /* storage indisponivel */ }
    void persist({ prefFontSize: v })
  }, [persist])

  const setHighContrast = useCallback((v: boolean) => {
    setHighContrastState(v)
    try { localStorage.setItem(LS_CONTRAST_KEY, String(v)) } catch { /* */ }
    void persist({ prefHighContrast: v })
  }, [persist])

  const setSpacingIncreased = useCallback((v: boolean) => {
    setSpacingIncreasedState(v)
    try { localStorage.setItem(LS_SPACING_KEY, String(v)) } catch { /* */ }
    void persist({ prefSpacingIncreased: v })
  }, [persist])

  const setFocusHighlight = useCallback((v: boolean) => {
    setFocusHighlightState(v)
    try { localStorage.setItem(LS_FOCUS_KEY, String(v)) } catch { /* */ }
    void persist({ prefFocusHighlight: v })
  }, [persist])

  const setExtraReducedMotion = useCallback((v: boolean) => {
    setExtraReducedMotionState(v)
    try { localStorage.setItem(LS_MOTION_KEY, String(v)) } catch { /* */ }
    void persist({ prefExtraReducedMotion: v })
  }, [persist])

  return (
    <AccessibilityContext.Provider
      value={{
        fontSize,
        highContrast,
        spacingIncreased,
        focusHighlight,
        extraReducedMotion,
        betaA11yV2: initialBetaA11yV2,
        saveStatus,
        setFontSize,
        setHighContrast,
        setSpacingIncreased,
        setFocusHighlight,
        setExtraReducedMotion,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  )
}

export function useAccessibility(): AccessibilityContextValue {
  const ctx = useContext(AccessibilityContext)
  if (!ctx) throw new Error('useAccessibility must be used inside <AccessibilityProvider>')
  return ctx
}
