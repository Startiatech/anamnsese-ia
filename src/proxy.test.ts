// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockVerifyToken } = vi.hoisted(() => ({
  mockVerifyToken: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  verifyToken: mockVerifyToken,
  COOKIE_NAME: 'anamnese_auth',
}))

import { proxy } from './proxy'

const VALID_PAYLOAD = { sub: 'u1', name: 'Test', email: 't@t.com', role: 'user' }

function makeRequest(pathname: string) {
  const req = new NextRequest(`http://localhost${pathname}`)
  req.cookies.set('anamnese_auth', 'valid-token')
  return req
}

beforeEach(() => {
  vi.clearAllMocks()
  mockVerifyToken.mockResolvedValue(VALID_PAYLOAD)
})

// Next.js expõe request headers forwarded via NextResponse.next() como
// x-middleware-request-{name} nos headers da resposta
function getForwardedHeader(res: Response, name: string) {
  return res.headers.get(`x-middleware-request-${name}`)
}

describe('proxy — x-is-plans header', () => {
  it('define x-is-plans como 1 em /plans', async () => {
    const res = await proxy(makeRequest('/plans'))
    expect(getForwardedHeader(res, 'x-is-plans')).toBe('1')
  })

  it('define x-is-plans como 1 em sub-rotas de /plans', async () => {
    const res = await proxy(makeRequest('/plans/upgrade'))
    expect(getForwardedHeader(res, 'x-is-plans')).toBe('1')
  })

  it('define x-is-plans como 0 em outras rotas autenticadas', async () => {
    for (const path of ['/dashboard', '/history', '/settings', '/consultation']) {
      const res = await proxy(makeRequest(path))
      expect(getForwardedHeader(res, 'x-is-plans')).toBe('0')
    }
  })
})

describe('proxy — x-is-onboarding header', () => {
  it('define x-is-onboarding como 1 em /settings', async () => {
    const res = await proxy(makeRequest('/settings'))
    expect(getForwardedHeader(res, 'x-is-onboarding')).toBe('1')
  })

  it('define x-is-onboarding como 0 em /plans', async () => {
    const res = await proxy(makeRequest('/plans'))
    expect(getForwardedHeader(res, 'x-is-onboarding')).toBe('0')
  })
})

describe('proxy — rotas públicas', () => {
  it('passa sem verificar token em /login', async () => {
    const req = new NextRequest('http://localhost/login')
    const res = await proxy(req)
    expect(mockVerifyToken).not.toHaveBeenCalled()
    expect(res.status).not.toBe(302)
  })

  it('passa sem verificar token em /api/stats', async () => {
    const req = new NextRequest('http://localhost/api/stats')
    const res = await proxy(req)
    expect(mockVerifyToken).not.toHaveBeenCalled()
    expect(res.status).not.toBe(307)
  })
})

describe('proxy — sem token', () => {
  it('redireciona para /login quando sem cookie', async () => {
    mockVerifyToken.mockResolvedValue(null)
    const res = await proxy(makeRequest('/dashboard'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })
})

describe('proxy — controle de acesso por role', () => {
  it('redireciona user para /dashboard quando acessa /console', async () => {
    mockVerifyToken.mockResolvedValue({ ...VALID_PAYLOAD, role: 'user' })
    const res = await proxy(makeRequest('/console'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/dashboard')
  })

  it('redireciona user para /dashboard quando acessa sub-rota /console/planos', async () => {
    mockVerifyToken.mockResolvedValue({ ...VALID_PAYLOAD, role: 'user' })
    const res = await proxy(makeRequest('/console/planos'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/dashboard')
  })

  it('permite admin acessar /console', async () => {
    mockVerifyToken.mockResolvedValue({ ...VALID_PAYLOAD, role: 'admin' })
    const res = await proxy(makeRequest('/console'))
    expect(res.status).not.toBe(307)
  })

  it('permite master acessar /console', async () => {
    mockVerifyToken.mockResolvedValue({ ...VALID_PAYLOAD, role: 'master' })
    const res = await proxy(makeRequest('/console'))
    expect(res.status).not.toBe(307)
  })
})

describe('proxy — bypass refinado de /api/auth', () => {
  it('passa /api/auth/login sem verificar token', async () => {
    const req = new NextRequest('http://localhost/api/auth/login')
    const res = await proxy(req)
    expect(mockVerifyToken).not.toHaveBeenCalled()
    expect(res.status).not.toBe(307)
  })

  it('passa /api/auth/forgot-password sem verificar token', async () => {
    const req = new NextRequest('http://localhost/api/auth/forgot-password')
    const res = await proxy(req)
    expect(mockVerifyToken).not.toHaveBeenCalled()
    expect(res.status).not.toBe(307)
  })

  it('verifica token em /api/auth/me (não é rota pública)', async () => {
    mockVerifyToken.mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/auth/me')
    req.cookies.set('anamnese_auth', 'expired-token')
    const res = await proxy(req)
    expect(mockVerifyToken).toHaveBeenCalledWith('expired-token')
    expect(res.status).toBe(307)
  })

  it('verifica token em /api/auth/me/credit (não é rota pública)', async () => {
    mockVerifyToken.mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/auth/me/credit')
    req.cookies.set('anamnese_auth', 'expired-token')
    const res = await proxy(req)
    expect(mockVerifyToken).toHaveBeenCalledWith('expired-token')
    expect(res.status).toBe(307)
  })
})
