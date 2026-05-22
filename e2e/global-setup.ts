import { config as loadEnv } from 'dotenv'

const TEST_PROJECT_REF = 'nnmpucgxehzvcliglayr'

async function globalSetup() {
  loadEnv({ path: '.env.test' })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !anon || !serviceRole) {
    throw new Error(
      'E2E abortado: variaveis ausentes no .env.test (NEXT_PUBLIC_SUPABASE_URL, ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY).'
    )
  }

  if (!url.includes(TEST_PROJECT_REF)) {
    throw new Error(
      `E2E abortado: NEXT_PUBLIC_SUPABASE_URL nao aponta para o projeto de teste ` +
        `(esperado ref "${TEST_PROJECT_REF}", recebido "${url}"). ` +
        `E2E nunca pode rodar contra producao.`
    )
  }

  console.log('[e2e] guard rail ok — apontando para banco de teste')
}

export default globalSetup
