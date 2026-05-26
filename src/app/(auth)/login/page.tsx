import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth-server'
import { LoginClient } from './login-client'

export default async function LoginPage() {
  const user = await getServerUser()

  if (user) {
    redirect(user.role === 'admin' || user.role === 'master' ? '/console' : '/app/dashboard')
  }

  return <LoginClient />
}
