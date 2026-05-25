'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Keyboard, X } from 'lucide-react'

interface Shortcut {
  keys: string[]
  description: string
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['Shift', '?'],          description: 'Abrir esta ajuda' },
  { keys: ['Esc'],                 description: 'Fechar diálogo' },
  { keys: ['Tab'],                 description: 'Navegar para o próximo elemento' },
  { keys: ['Shift', 'Tab'],        description: 'Navegar para o elemento anterior' },
  { keys: ['Enter'],               description: 'Ativar o elemento focado' },
]

function isEditableTarget(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  return false
}

export function KeyboardShortcutsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) {
        setOpen(false)
        return
      }
      if (e.key === '?' && e.shiftKey && !isEditableTarget(e.target)) {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <>
      {children}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="shortcuts-modal-title"
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-2xl overflow-hidden bg-card border border-border shadow-xl"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Keyboard className="h-5 w-5 text-violet-400" />
                <h2 id="shortcuts-modal-title" className="text-base font-semibold text-foreground">
                  Atalhos de teclado
                </h2>
              </div>
              <button
                type="button"
                aria-label="Fechar atalhos"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ul className="px-6 py-4 space-y-3">
              {SHORTCUTS.map((s) => (
                <li key={s.description} className="flex items-center justify-between gap-4">
                  <span className="text-sm text-foreground">{s.description}</span>
                  <span className="flex items-center gap-1">
                    {s.keys.map((k, i) => (
                      <kbd
                        key={`${s.description}-${i}`}
                        className="px-2 py-0.5 text-xs font-mono bg-muted border border-border rounded text-foreground"
                      >
                        {k}
                      </kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>

            <div className="px-6 py-3 border-t border-border bg-muted/30">
              <p className="text-xs text-muted-foreground">
                Pressione <kbd className="px-1.5 py-0.5 text-xs font-mono bg-card border border-border rounded">?</kbd> a qualquer momento para reabrir esta ajuda.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
