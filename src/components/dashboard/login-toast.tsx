'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export function LoginToast({ userName }: { userName: string }) {
  const router = useRouter()

  useEffect(() => {
    const t = setTimeout(() => {
      toast.success(`Bem-vindo de volta, ${userName.split(' ')[0]}!`)
    }, 100)
    // Remove ?login=1 da URL sem recarregar
    router.replace(window.location.pathname)
    return () => clearTimeout(t)
  }, [])

  return null
}
