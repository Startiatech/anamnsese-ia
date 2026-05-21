import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import path from 'path'

// loadEnv('test', cwd, '') lê: .env, .env.local, .env.test, .env.test.local
// Necessário porque Vitest não carrega .env.local automaticamente (isso é Next.js).
const env = loadEnv('test', process.cwd(), '')

const supabaseUrl =
  process.env.TEST_SUPABASE_URL ??
  env.TEST_SUPABASE_URL ??
  env.NEXT_PUBLIC_SUPABASE_URL

const supabaseKey =
  process.env.TEST_SUPABASE_SERVICE_KEY ??
  env.TEST_SUPABASE_SERVICE_KEY ??
  env.SUPABASE_SERVICE_ROLE_KEY

export default defineConfig({
  test: {
    pool: 'forks',
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    setupFiles: ['./vitest.integration.setup.ts'],
    env: {
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ?? '',
      SUPABASE_SERVICE_ROLE_KEY: supabaseKey ?? '',
      JWT_SECRET: process.env.JWT_SECRET ?? env.JWT_SECRET ?? '',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
