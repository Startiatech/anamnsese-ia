import { config as loadEnv } from 'dotenv'
import { cleanupE2eData } from './fixtures/seed'

async function globalTeardown() {
  loadEnv({ path: '.env.test' })
  try {
    await cleanupE2eData()
  } catch (err) {
    console.error('[e2e] teardown falhou:', err)
  }
}

export default globalTeardown
