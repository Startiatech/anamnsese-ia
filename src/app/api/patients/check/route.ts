import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/server/services/session'
import { PatientRepository } from '@/server/repositories/db'

export async function GET(req: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cpf = req.nextUrl.searchParams.get('cpf')?.trim() || ''
  const externalId = req.nextUrl.searchParams.get('externalId')?.trim() || ''
  const excludeId = req.nextUrl.searchParams.get('excludeId')?.trim() || ''

  const cpfValid = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(cpf)

  const [cpfMatch, externalMatch] = await Promise.all([
    cpfValid ? PatientRepository.findByCPF(user.sub, cpf) : Promise.resolve(null),
    externalId ? PatientRepository.findByExternalId(user.sub, externalId) : Promise.resolve(null),
  ])

  return NextResponse.json({
    cpfExists: cpfMatch ? cpfMatch.id !== excludeId : false,
    externalIdExists: externalMatch ? externalMatch.id !== excludeId : false,
  })
}
