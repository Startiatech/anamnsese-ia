// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetServerUser, mockUpdatePrefs } = vi.hoisted(() => ({
  mockGetServerUser: vi.fn(),
  mockUpdatePrefs: vi.fn(),
}))

vi.mock('@/server/services/session', () => ({ getServerUser: mockGetServerUser }))
vi.mock('@/server/repositories/users', () => ({ updateAccessibilityPrefs: mockUpdatePrefs }))

import { updateAccessibilityAction } from './accessibility'

describe('updateAccessibilityAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejeita quando nao autenticado', async () => {
    mockGetServerUser.mockResolvedValue(null)

    const result = await updateAccessibilityAction({ fontSize: 'large' })

    expect(result).toEqual({ ok: false, error: 'Unauthorized' })
    expect(mockUpdatePrefs).not.toHaveBeenCalled()
  })

  it('persiste fontSize valido para o usuario autenticado', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1', role: 'user' })
    mockUpdatePrefs.mockResolvedValue(undefined)

    const result = await updateAccessibilityAction({ fontSize: 'large' })

    expect(mockUpdatePrefs).toHaveBeenCalledWith('u1', { fontSize: 'large' })
    expect(result).toEqual({ ok: true })
  })

  it('persiste highContrast booleano', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1', role: 'user' })

    const result = await updateAccessibilityAction({ highContrast: true })

    expect(mockUpdatePrefs).toHaveBeenCalledWith('u1', { highContrast: true })
    expect(result).toEqual({ ok: true })
  })

  it('aceita ambos os campos no mesmo update', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1', role: 'user' })

    await updateAccessibilityAction({ fontSize: 'xlarge', highContrast: true })

    expect(mockUpdatePrefs).toHaveBeenCalledWith('u1', { fontSize: 'xlarge', highContrast: true })
  })

  it('rejeita fontSize fora do enum', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1', role: 'user' })

    // @ts-expect-error — valor invalido proposital
    const result = await updateAccessibilityAction({ fontSize: 'huge' })

    expect(result.ok).toBe(false)
    expect(mockUpdatePrefs).not.toHaveBeenCalled()
  })

  it('rejeita payload vazio', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1', role: 'user' })

    const result = await updateAccessibilityAction({})

    expect(result.ok).toBe(false)
    expect(mockUpdatePrefs).not.toHaveBeenCalled()
  })

  it('retorna erro quando repository lanca', async () => {
    mockGetServerUser.mockResolvedValue({ sub: 'u1', role: 'user' })
    mockUpdatePrefs.mockRejectedValue(new Error('db down'))

    const result = await updateAccessibilityAction({ fontSize: 'normal' })

    expect(result).toEqual({ ok: false, error: 'Erro ao salvar preferências' })
  })
})
