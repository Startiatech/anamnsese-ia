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

function wrapperWithA11y(initialA11yPendingCount: number) {
  return ({ children }: { children: React.ReactNode }) => (
    <ConsoleNotificationProvider
      initialRequests={[]}
      initialA11yPendingCount={initialA11yPendingCount}
    >
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

  // ─── a11yPendingCount (Fase 3) ─────────────────────────────────────────

  it('a11yPendingCount comeca em 0 quando nao informado', () => {
    const { result } = renderHook(() => useConsoleNotification(), { wrapper })
    expect(result.current.a11yPendingCount).toBe(0)
  })

  it('a11yPendingCount reflete o valor inicial informado', () => {
    const { result } = renderHook(() => useConsoleNotification(), { wrapper: wrapperWithA11y(3) })
    expect(result.current.a11yPendingCount).toBe(3)
  })

  it('syncA11yCount atualiza o valor do badge', () => {
    const { result } = renderHook(() => useConsoleNotification(), { wrapper: wrapperWithA11y(2) })
    act(() => {
      result.current.syncA11yCount(5)
    })
    expect(result.current.a11yPendingCount).toBe(5)
  })

  it('syncA11yCount permite decrementar quando admin marca como lido', () => {
    const { result } = renderHook(() => useConsoleNotification(), { wrapper: wrapperWithA11y(3) })
    act(() => {
      result.current.syncA11yCount(2)
    })
    expect(result.current.a11yPendingCount).toBe(2)
  })
})
