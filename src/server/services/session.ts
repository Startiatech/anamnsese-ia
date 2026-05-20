import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/server/services/auth'
import type { JWTPayload } from '@/server/services/auth'
import { findUserById } from '@/server/repositories/users'

export async function getServerUser(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

export async function requireActiveUser(): Promise<JWTPayload | null> {
  const sessionUser = await getServerUser()
  if (!sessionUser) return null
  const storedUser = await findUserById(sessionUser.sub)
  if (!storedUser || storedUser.blocked) return null
  return sessionUser
}

export type { JWTPayload }
