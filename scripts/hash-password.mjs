// Gera hash bcrypt compativel com o app (12 rounds).
// Uso: node scripts/hash-password.mjs "<senha>"
import bcrypt from 'bcryptjs'

const password = process.argv[2]
if (!password) {
  console.error('Uso: node scripts/hash-password.mjs "<senha>"')
  process.exit(1)
}

const hash = await bcrypt.hash(password, 12)
console.log(hash)
