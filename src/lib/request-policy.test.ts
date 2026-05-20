import { describe, it, expect } from 'vitest'
import { checkDuplicateRequest } from '@/lib/request-policy'
import type { AccessRequest } from '@/lib/types'

const make = (status: AccessRequest['status']): AccessRequest => ({
  id: '1', name: 'Dr. Test', email: 'test@test.com',
  specialty: 'Cardiologia', phone: '5511999', message: '',
  status, createdAt: new Date().toISOString(),
})

describe('checkDuplicateRequest', () => {
  it('returns null when no previous request', () => {
    expect(checkDuplicateRequest(undefined)).toBeNull()
  })

  it('blocks when previous request is pending', () => {
    expect(checkDuplicateRequest(make('pending'))).toEqual({ block: true, status: 'pending' })
  })

  it('blocks when previous request is approved', () => {
    expect(checkDuplicateRequest(make('approved'))).toEqual({ block: true, status: 'approved' })
  })

  it('allows when previous request was rejected', () => {
    expect(checkDuplicateRequest(make('rejected'))).toEqual({ block: false, status: 'rejected' })
  })
})
