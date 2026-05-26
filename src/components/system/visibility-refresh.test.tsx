import { render, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRefresh } = vi.hoisted(() => ({ mockRefresh: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

import { VisibilityRefresh } from './visibility-refresh'

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('VisibilityRefresh', () => {
  beforeEach(() => vi.clearAllMocks())

  it('chama router.refresh quando a aba volta a ficar visivel', () => {
    render(<VisibilityRefresh />)
    act(() => setVisibility('visible'))
    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })

  it('NAO chama router.refresh quando a aba fica oculta', () => {
    render(<VisibilityRefresh />)
    act(() => setVisibility('hidden'))
    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it('remove o listener ao desmontar', () => {
    const { unmount } = render(<VisibilityRefresh />)
    unmount()
    act(() => setVisibility('visible'))
    expect(mockRefresh).not.toHaveBeenCalled()
  })
})
