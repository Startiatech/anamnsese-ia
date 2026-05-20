import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React from 'react'
import { ConsoleNotificationProvider, useConsoleNotification } from './console-notification-context'
import type { AccessRequest } from '@/lib/types'

const makeRequest = (id: string, status: AccessRequest['status']): AccessRequest => ({
  id,
  name: 'Dr. Test',
  email: 'test@test.com',
  specialty: 'Cardiologia',
  phone: '5511999999999',
  message: '',
  status,
  createdAt: new Date().toISOString(),
})

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <ConsoleNotificationProvider initialRequests={[
      makeRequest('1', 'pending'),
      makeRequest('2', 'pending'),
      makeRequest('3', 'approved'),
    ]}>
      {children}
    </ConsoleNotificationProvider>
  )
}

describe('useConsoleNotification', () => {
  it('returns pendingCount from initial requests', () => {
    const { result } = renderHook(() => useConsoleNotification(), { wrapper })
    expect(result.current.pendingCount).toBe(2)
  })

  it('returns requests list', () => {
    const { result } = renderHook(() => useConsoleNotification(), { wrapper })
    expect(result.current.requests).toHaveLength(3)
  })

  it('updates pendingCount when setRequests is called', () => {
    const { result } = renderHook(() => useConsoleNotification(), { wrapper })
    act(() => {
      result.current.setRequests([makeRequest('1', 'approved')])
    })
    expect(result.current.pendingCount).toBe(0)
  })
})
