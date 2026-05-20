// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetServerUser, mockRevalidatePath } = vi.hoisted(() => ({
  mockGetServerUser: vi.fn(),
  mockRevalidatePath: vi.fn(),
}))

vi.mock('@/server/services/session', () => ({ getServerUser: mockGetServerUser }))
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }))

// Supabase chain mock
let mockUpdate: ReturnType<typeof vi.fn>
let mockInsert: ReturnType<typeof vi.fn>
let mockDelete: ReturnType<typeof vi.fn>
let mockEq: ReturnType<typeof vi.fn>
let mockSelect: ReturnType<typeof vi.fn>
let mockSingle: ReturnType<typeof vi.fn>

function buildChain() {
  mockSingle = vi.fn()
  mockEq = vi.fn()
  mockSelect = vi.fn()
  mockUpdate = vi.fn()
  mockInsert = vi.fn()
  mockDelete = vi.fn()

  mockEq.mockReturnValue({ eq: mockEq })
  mockUpdate.mockReturnValue({ eq: mockEq })
  mockDelete.mockReturnValue({ eq: mockEq })
  mockSelect.mockReturnValue({ single: mockSingle })
  mockInsert.mockReturnValue({ select: mockSelect })
}

buildChain()

vi.mock('@/server/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: mockUpdate,
      insert: mockInsert,
      delete: mockDelete,
    })),
  },
}))

// Must import after mocks
import { updatePlan, createPlan, deletePlan } from './plans'

const adminUser = { sub: 'u1', role: 'admin' as const, email: 'a@t.com', name: 'Admin' }
const masterUser = { sub: 'u2', role: 'master' as const, email: 'm@t.com', name: 'Master' }

const basePlan = {
  id: 'plano-basico',
  name: 'Plano Básico',
  description: 'Desc',
  price: 0,
  quota: 5,
  active: true,
  features: [{ id: 'f1', label: 'Feature', active: true }],
}

// ─── updatePlan ───────────────────────────────────────────────────────────────

describe('updatePlan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    buildChain()
    mockGetServerUser.mockResolvedValue(adminUser)
    mockEq.mockResolvedValue({ error: null })
  })

  it('retorna Forbidden quando não autenticado', async () => {
    mockGetServerUser.mockResolvedValue(null)
    const result = await updatePlan(basePlan)
    expect(result).toEqual({ error: 'Forbidden' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('retorna Forbidden quando role é user', async () => {
    mockGetServerUser.mockResolvedValue({ ...adminUser, role: 'user' })
    const result = await updatePlan(basePlan)
    expect(result).toEqual({ error: 'Forbidden' })
  })

  it('permite admin atualizar plano', async () => {
    const result = await updatePlan(basePlan)
    expect(result).toEqual({})
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Plano Básico', quota: 5 }))
  })

  it('permite master atualizar plano', async () => {
    mockGetServerUser.mockResolvedValue(masterUser)
    const result = await updatePlan(basePlan)
    expect(result).toEqual({})
  })

  it('retorna error quando supabase falha', async () => {
    mockEq.mockResolvedValue({ error: { message: 'DB error' } })
    const result = await updatePlan(basePlan)
    expect(result).toEqual({ error: 'DB error' })
  })

  it('chama revalidatePath após atualização bem-sucedida', async () => {
    await updatePlan(basePlan)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/console/planos')
  })

  it('não chama revalidatePath quando supabase falha', async () => {
    mockEq.mockResolvedValue({ error: { message: 'DB error' } })
    await updatePlan(basePlan)
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })
})

// ─── createPlan ───────────────────────────────────────────────────────────────

describe('createPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    buildChain()
    mockGetServerUser.mockResolvedValue(adminUser)
    mockSingle.mockResolvedValue({ data: { id: 'plano-basico' }, error: null })
  })

  it('retorna Forbidden quando não autenticado', async () => {
    mockGetServerUser.mockResolvedValue(null)
    const result = await createPlan(basePlan)
    expect(result).toEqual({ error: 'Forbidden' })
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('retorna Forbidden quando role é user', async () => {
    mockGetServerUser.mockResolvedValue({ ...adminUser, role: 'user' })
    const result = await createPlan(basePlan)
    expect(result).toEqual({ error: 'Forbidden' })
  })

  it('gera id a partir do nome: espaços viram hífens', async () => {
    await createPlan({ ...basePlan, name: 'Plano Premium' })
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ id: 'plano-premium' }))
  })

  it('gera id a partir do nome: caracteres especiais são removidos', async () => {
    await createPlan({ ...basePlan, name: 'Plano Especial!' })
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ id: 'plano-especial' }))
  })

  it('retorna o id do plano criado', async () => {
    mockSingle.mockResolvedValue({ data: { id: 'plano-basico' }, error: null })
    const result = await createPlan(basePlan)
    expect(result).toEqual({ id: 'plano-basico' })
  })

  it('retorna error quando supabase falha', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'Duplicate key' } })
    const result = await createPlan(basePlan)
    expect(result).toEqual({ error: 'Duplicate key' })
  })

  it('chama revalidatePath após criação bem-sucedida', async () => {
    await createPlan(basePlan)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/console/planos')
  })

  it('usa sort_order 99 por padrão quando não informado', async () => {
    await createPlan(basePlan)
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ sort_order: 99 }))
  })

  it('usa sort_order informado quando fornecido', async () => {
    await createPlan({ ...basePlan, sort_order: 1 })
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ sort_order: 1 }))
  })
})

// ─── deletePlan ───────────────────────────────────────────────────────────────

describe('deletePlan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    buildChain()
    mockGetServerUser.mockResolvedValue(adminUser)
    mockEq.mockResolvedValue({ error: null })
  })

  it('retorna Forbidden quando não autenticado', async () => {
    mockGetServerUser.mockResolvedValue(null)
    const result = await deletePlan('plano-basico')
    expect(result).toEqual({ error: 'Forbidden' })
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('retorna Forbidden quando role é user', async () => {
    mockGetServerUser.mockResolvedValue({ ...adminUser, role: 'user' })
    const result = await deletePlan('plano-basico')
    expect(result).toEqual({ error: 'Forbidden' })
  })

  it('permite admin deletar plano', async () => {
    const result = await deletePlan('plano-basico')
    expect(result).toEqual({})
    expect(mockDelete).toHaveBeenCalled()
    expect(mockEq).toHaveBeenCalledWith('id', 'plano-basico')
  })

  it('permite master deletar plano', async () => {
    mockGetServerUser.mockResolvedValue(masterUser)
    const result = await deletePlan('plano-basico')
    expect(result).toEqual({})
  })

  it('retorna error quando supabase falha', async () => {
    mockEq.mockResolvedValue({ error: { message: 'Foreign key violation' } })
    const result = await deletePlan('plano-basico')
    expect(result).toEqual({ error: 'Foreign key violation' })
  })

  it('chama revalidatePath após deleção bem-sucedida', async () => {
    await deletePlan('plano-basico')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/console/planos')
  })

  it('não chama revalidatePath quando supabase falha', async () => {
    mockEq.mockResolvedValue({ error: { message: 'error' } })
    await deletePlan('plano-basico')
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })
})
