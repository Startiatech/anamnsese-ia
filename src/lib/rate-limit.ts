import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const MAX_ATTEMPTS = 5
const WINDOW = '15 m'

// In-memory fallback when Upstash env vars are not set (local dev)
interface MemWindow { count: number; resetAt: number }
const memStore = new Map<string, MemWindow>()
const MEM_WINDOW_MS = 15 * 60 * 1000

function checkMemory(key: string): boolean {
  const now = Date.now()
  const entry = memStore.get(key)
  if (!entry || now >= entry.resetAt) {
    memStore.set(key, { count: 1, resetAt: now + MEM_WINDOW_MS })
    return false
  }
  entry.count += 1
  return entry.count > MAX_ATTEMPTS
}

const upstash =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Ratelimit({
        redis: Redis.fromEnv(),
        limiter: Ratelimit.slidingWindow(MAX_ATTEMPTS, WINDOW),
        analytics: false,
      })
    : null

export async function checkRateLimit(key: string): Promise<boolean> {
  if (!upstash) return checkMemory(key)
  const { success } = await upstash.limit(key)
  return !success
}
