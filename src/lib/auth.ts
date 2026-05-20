// Re-export from new location — use @/server/services/auth directly in new code
export { signToken, verifyToken, hashPassword, comparePassword, comparePin, isLegacyHash, COOKIE_NAME } from '@/server/services/auth'
export type { JWTPayload } from '@/server/services/auth'
