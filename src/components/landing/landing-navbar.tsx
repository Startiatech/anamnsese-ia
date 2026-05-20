'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'
import { ThemeToggle } from '@/components/ui/theme-toggle'

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 60)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center px-6 transition-all duration-500"
      style={{
        background: scrolled ? 'var(--topbar-scrolled-bg)' : 'transparent',
        backdropFilter: scrolled ? 'blur(24px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(24px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--topbar-scrolled-border)' : '1px solid var(--topbar-initial-border)',
      }}
    >
      <nav className="w-full max-w-5xl flex items-center h-16 gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <Logo size="md" />
        </Link>

        <div className="flex-1" />

        {/* Nav links */}
        <div className="flex items-center gap-1">
          <ThemeToggle />

          <a
            href="#planos"
            className="hidden sm:flex h-8 items-center px-3 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
          >
            Planos
          </a>

          <Link
            href="/login?mode=solicitar"
            className="hidden sm:flex h-8 items-center px-3 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
          >
            Solicitar acesso
          </Link>

          <div className="w-px h-5 bg-border mx-2 hidden sm:block" />

          <Link href="/login">
            <Button
              size="sm"
              className="h-8 px-4 text-xs rounded-xl"
              style={{ boxShadow: 'none' }}
            >
              Entrar
            </Button>
          </Link>
        </div>
      </nav>
    </div>
  )
}
