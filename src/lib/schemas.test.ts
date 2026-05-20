import { describe, it, expect } from 'vitest'
import {
  loginSchema,
  accessRequestSchema,
  createUserSchema,
  patientSchema,
  responsibilitySchema,
  profileSchema,
  planInterestSchema,
  REGISTRY_TYPES,
} from './schemas'

// ─── loginSchema ─────────────────────────────────────────────────────────────

describe('loginSchema', () => {
  it('accepts valid email and password', () => {
    expect(loginSchema.safeParse({ email: 'user@example.com', password: 'abc123' }).success).toBe(true)
  })

  it('rejects empty email', () => {
    const r = loginSchema.safeParse({ email: '', password: 'abc123' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toBe('Email é obrigatório')
  })

  it('rejects invalid email format', () => {
    const r = loginSchema.safeParse({ email: 'not-an-email', password: 'abc123' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toBe('Email inválido')
  })

  it('rejects empty password', () => {
    const r = loginSchema.safeParse({ email: 'user@example.com', password: '' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toBe('Senha é obrigatória')
  })
})

// ─── accessRequestSchema ──────────────────────────────────────────────────────

describe('accessRequestSchema', () => {
  const valid = { name: 'Ana Lima', email: 'ana@example.com', specialty: 'Cardiologia' }

  it('accepts valid data without message', () => {
    expect(accessRequestSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts valid data with optional message', () => {
    expect(accessRequestSchema.safeParse({ ...valid, message: 'Olá!' }).success).toBe(true)
  })

  it('rejects name shorter than 2 chars', () => {
    const r = accessRequestSchema.safeParse({ ...valid, name: 'A' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toContain('2 caracteres')
  })

  it('rejects invalid email', () => {
    expect(accessRequestSchema.safeParse({ ...valid, email: 'bad' }).success).toBe(false)
  })

  it('rejects specialty shorter than 2 chars', () => {
    expect(accessRequestSchema.safeParse({ ...valid, specialty: 'X' }).success).toBe(false)
  })
})

// ─── createUserSchema ─────────────────────────────────────────────────────────

describe('createUserSchema', () => {
  const valid = {
    name: 'Dr. João',
    email: 'joao@clinic.com',
    specialty: 'Ortopedia',
    phone: '11999990000',
  }

  it('accepts valid data', () => {
    expect(createUserSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects phone shorter than 8 chars', () => {
    const r = createUserSchema.safeParse({ ...valid, phone: '1234' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toContain('telefone')
  })

  it('rejects name shorter than 2 chars', () => {
    expect(createUserSchema.safeParse({ ...valid, name: 'X' }).success).toBe(false)
  })

  it('rejects invalid email', () => {
    expect(createUserSchema.safeParse({ ...valid, email: 'notvalid' }).success).toBe(false)
  })

  it('rejects specialty shorter than 2 chars', () => {
    expect(createUserSchema.safeParse({ ...valid, specialty: 'X' }).success).toBe(false)
  })
})

// ─── patientSchema ────────────────────────────────────────────────────────────

describe('patientSchema', () => {
  const valid = { name: 'Maria Santos', cpf: '529.982.247-25', birthDate: '1990-05-20' }

  it('accepts valid name, CPF and birthDate', () => {
    expect(patientSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts optional phone', () => {
    expect(patientSchema.safeParse({ ...valid, phone: '11999990000' }).success).toBe(true)
  })

  it('rejects empty name', () => {
    const r = patientSchema.safeParse({ ...valid, name: '' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toBe('Nome é obrigatório')
  })

  it('rejects CPF without mask (only digits)', () => {
    const r = patientSchema.safeParse({ ...valid, cpf: '52998224725' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toContain('CPF inválido')
  })

  it('rejects CPF with incomplete mask', () => {
    expect(patientSchema.safeParse({ ...valid, cpf: '529.982.247-2' }).success).toBe(false)
  })

  it('rejects empty CPF', () => {
    expect(patientSchema.safeParse({ ...valid, cpf: '' }).success).toBe(false)
  })

  // dígitos verificadores
  it('rejects CPF with correct format but wrong check digits', () => {
    const r = patientSchema.safeParse({ ...valid, cpf: '123.456.789-00' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toBe('CPF inválido')
  })

  it('rejects CPF with all same digits (111.111.111-11)', () => {
    expect(patientSchema.safeParse({ ...valid, cpf: '111.111.111-11' }).success).toBe(false)
  })

  it('rejects CPF with all zeros (000.000.000-00)', () => {
    expect(patientSchema.safeParse({ ...valid, cpf: '000.000.000-00' }).success).toBe(false)
  })

  it('rejects CPF where only first check digit is wrong', () => {
    expect(patientSchema.safeParse({ ...valid, cpf: '529.982.247-35' }).success).toBe(false)
  })

  it('rejects CPF where only second check digit is wrong', () => {
    expect(patientSchema.safeParse({ ...valid, cpf: '529.982.247-24' }).success).toBe(false)
  })
})

// ─── max length / XSS mitigation ─────────────────────────────────────────────

describe('schemas — max length limits', () => {
  it('rejects password longer than 200 chars', () => {
    const r = loginSchema.safeParse({ email: 'u@x.com', password: 'a'.repeat(201) })
    expect(r.success).toBe(false)
  })

  it('rejects name longer than 100 chars in accessRequestSchema', () => {
    const r = accessRequestSchema.safeParse({
      name: 'A'.repeat(101),
      email: 'a@b.com',
      specialty: 'Cardiologia',
    })
    expect(r.success).toBe(false)
  })

  it('rejects message longer than 1000 chars in accessRequestSchema', () => {
    const r = accessRequestSchema.safeParse({
      name: 'Ana',
      email: 'a@b.com',
      specialty: 'Cardiologia',
      message: 'x'.repeat(1001),
    })
    expect(r.success).toBe(false)
  })

  it('rejects name longer than 100 chars in patientSchema', () => {
    const r = patientSchema.safeParse({
      name: 'A'.repeat(101),
      cpf: '529.982.247-25',
      birthDate: '1990-01-01',
    })
    expect(r.success).toBe(false)
  })

  it('rejects phone longer than 20 chars in patientSchema', () => {
    const r = patientSchema.safeParse({
      name: 'Ana',
      cpf: '529.982.247-25',
      birthDate: '1990-01-01',
      phone: '1'.repeat(21),
    })
    expect(r.success).toBe(false)
  })
})

// ─── profileSchema ────────────────────────────────────────────────────────────

describe('profileSchema', () => {
  const valid = {
    name: 'Dr. Ana Lima',
    specialty: 'Cardiologia',
    crmType: 'CRM' as const,
    crmNumber: '12345',
    crmUf: 'SP',
    minutesPerConsultation: 45,
  }

  it('accepts valid profile with known registry type', () => {
    expect(profileSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts all known registry types', () => {
    const knownTypes = REGISTRY_TYPES.filter((t) => t !== 'Outros')
    for (const type of knownTypes) {
      const r = profileSchema.safeParse({ ...valid, crmType: type })
      expect(r.success, `expected ${type} to be valid`).toBe(true)
    }
  })

  it('accepts Outros with valid crmTypeCustom', () => {
    const r = profileSchema.safeParse({ ...valid, crmType: 'Outros', crmTypeCustom: 'CRESS' })
    expect(r.success).toBe(true)
  })

  it('rejects Outros without crmTypeCustom', () => {
    const r = profileSchema.safeParse({ ...valid, crmType: 'Outros' })
    expect(r.success).toBe(false)
    const paths = r.error?.issues.map((i) => i.path[0])
    expect(paths).toContain('crmTypeCustom')
  })

  it('rejects Outros with empty crmTypeCustom', () => {
    const r = profileSchema.safeParse({ ...valid, crmType: 'Outros', crmTypeCustom: '' })
    expect(r.success).toBe(false)
    const paths = r.error?.issues.map((i) => i.path[0])
    expect(paths).toContain('crmTypeCustom')
  })

  it('rejects unknown crmType', () => {
    const r = profileSchema.safeParse({ ...valid, crmType: 'XPTO' })
    expect(r.success).toBe(false)
  })

  it('rejects name shorter than 3 chars', () => {
    expect(profileSchema.safeParse({ ...valid, name: 'AB' }).success).toBe(false)
  })

  it('rejects crmNumber with letters', () => {
    const r = profileSchema.safeParse({ ...valid, crmNumber: '123AB' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toContain('Número inválido')
  })

  it('rejects crmNumber shorter than 4 digits', () => {
    expect(profileSchema.safeParse({ ...valid, crmNumber: '123' }).success).toBe(false)
  })

  it('rejects crmNumber longer than 8 digits', () => {
    expect(profileSchema.safeParse({ ...valid, crmNumber: '123456789' }).success).toBe(false)
  })

  it('rejects crmUf with wrong length', () => {
    expect(profileSchema.safeParse({ ...valid, crmUf: 'SPA' }).success).toBe(false)
  })

  it('rejects minutesPerConsultation below 5', () => {
    expect(profileSchema.safeParse({ ...valid, minutesPerConsultation: 4 }).success).toBe(false)
  })

  it('rejects minutesPerConsultation above 240', () => {
    expect(profileSchema.safeParse({ ...valid, minutesPerConsultation: 241 }).success).toBe(false)
  })

  it('accepts optional phone', () => {
    expect(profileSchema.safeParse({ ...valid, phone: '11999990000' }).success).toBe(true)
  })

  it('rejects crmTypeCustom longer than 50 chars', () => {
    const r = profileSchema.safeParse({ ...valid, crmType: 'Outros', crmTypeCustom: 'A'.repeat(51) })
    expect(r.success).toBe(false)
  })
})

// ─── responsibilitySchema ─────────────────────────────────────────────────────

describe('responsibilitySchema', () => {
  it('accepts confirmed=true', () => {
    expect(responsibilitySchema.safeParse({ confirmed: true }).success).toBe(true)
  })

  it('rejects confirmed=false', () => {
    expect(responsibilitySchema.safeParse({ confirmed: false }).success).toBe(false)
  })

  it('rejects missing confirmed field', () => {
    expect(responsibilitySchema.safeParse({}).success).toBe(false)
  })
})

// ─── planInterestSchema ───────────────────────────────────────────────────────
describe('planInterestSchema', () => {
  it('aceita dados válidos — profissional', () => {
    expect(planInterestSchema.safeParse({ name: 'João Silva', email: 'joao@email.com', plan: 'profissional' }).success).toBe(true)
  })

  it('aceita dados válidos — gestao-clinicas', () => {
    expect(planInterestSchema.safeParse({ name: 'Maria Souza', email: 'maria@clinica.com', plan: 'gestao-clinicas' }).success).toBe(true)
  })

  it('rejeita nome com menos de 2 caracteres', () => {
    expect(planInterestSchema.safeParse({ name: 'A', email: 'a@b.com', plan: 'profissional' }).success).toBe(false)
  })

  it('rejeita nome com mais de 100 caracteres', () => {
    expect(planInterestSchema.safeParse({ name: 'A'.repeat(101), email: 'a@b.com', plan: 'profissional' }).success).toBe(false)
  })

  it('rejeita email inválido', () => {
    expect(planInterestSchema.safeParse({ name: 'João Silva', email: 'nao-e-email', plan: 'profissional' }).success).toBe(false)
  })

  it('rejeita email vazio', () => {
    expect(planInterestSchema.safeParse({ name: 'João Silva', email: '', plan: 'profissional' }).success).toBe(false)
  })

  it('rejeita plan fora do enum', () => {
    expect(planInterestSchema.safeParse({ name: 'João Silva', email: 'a@b.com', plan: 'enterprise' }).success).toBe(false)
  })

  it('rejeita plan ausente', () => {
    expect(planInterestSchema.safeParse({ name: 'João Silva', email: 'a@b.com' }).success).toBe(false)
  })

  it('faz trim no nome', () => {
    const result = planInterestSchema.safeParse({ name: '  João Silva  ', email: 'a@b.com', plan: 'profissional' })
    expect(result.success && result.data.name).toBe('João Silva')
  })
})
