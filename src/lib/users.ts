// Re-export from new location — use @/server/repositories/users directly in new code
export { findUserByEmail, findUserById, addUser, listUsers, updateUser, deleteUser } from '@/server/repositories/users'
export type { StoredUser, UserRole } from '@/server/repositories/users'
