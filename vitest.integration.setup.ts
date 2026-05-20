// Valida que as credenciais foram resolvidas pelo vitest.integration.ts.
// Para usar banco isolado, crie .env.test.local com:
//   TEST_SUPABASE_URL=https://<projeto-de-teste>.supabase.co
//   TEST_SUPABASE_SERVICE_KEY=<service-role-key>
// Sem isso, usa as credenciais do .env.local (banco de dev).

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    '[integration] Credenciais do Supabase não encontradas.\n' +
    'Verifique se .env.local existe com NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.',
  )
}
