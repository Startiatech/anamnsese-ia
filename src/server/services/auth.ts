import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'

const jwtSecretValue = process.env.JWT_SECRET
if (!jwtSecretValue) throw new Error('JWT_SECRET environment variable is not set')
const JWT_SECRET = new TextEncoder().encode(jwtSecretValue)

const COOKIE_NAME = 'anamnese_auth'
const TOKEN_EXPIRY = '7d'

export interface JWTPayload {
  sub: string       // user id
  email: string
  name: string
  role: 'user' | 'admin' | 'master'
  planId?: string
  specialty?: string
  crmType?: string
  crmNumber?: string
  crmUf?: string
  hasPin?: boolean
  passwordIsTemp?: boolean
  pinIsTemp?: boolean
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function comparePassword(password: string, stored: string): Promise<boolean> {
  // Novo formato bcrypt
  if (stored.startsWith('$2b$') || stored.startsWith('$2a$')) {
    return bcrypt.compare(password, stored)
  }
  // Formato legado SHA-256: saltHex:hashHex
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const encoder = new TextEncoder()
  const data = encoder.encode(salt + password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return hashHex === hash
}

export function isLegacyHash(stored: string): boolean {
  return !stored.startsWith('$2b$') && !stored.startsWith('$2a$')
}

export async function comparePin(pin: string, stored: string): Promise<boolean> {
  return bcrypt.compare(pin, stored)
}

export { COOKIE_NAME }
