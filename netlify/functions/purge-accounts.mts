import type { Config } from '@netlify/functions'
import { findUsersScheduledForDeletion, deleteUser } from '../../src/server/repositories/users'

export default async function handler() {
  const users = await findUsersScheduledForDeletion()
  await Promise.all(users.map((u) => deleteUser(u.id)))
  console.log(`[purge-accounts] Purged ${users.length} account(s)`)
}

// Runs every day at 3am UTC
export const config: Config = {
  schedule: '0 3 * * *',
}
