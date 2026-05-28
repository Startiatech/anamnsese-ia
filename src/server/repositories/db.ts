import { supabase } from '@/server/supabase'
import type { Patient, PatientWithStats, Consultation, StructuredAnamnesis } from '@/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toPatient(row: Record<string, unknown>): Patient {
  return {
    id: row.id as string,
    name: row.name as string,
    cpf: row.cpf as string,
    birthDate: row.birth_date as string ?? undefined,
    phone: row.phone as string ?? undefined,
    externalId: row.external_id as string ?? undefined,
    createdAt: row.created_at as string,
  }
}

function toConsultation(row: Record<string, unknown>): Consultation {
  return {
    id: row.id as string,
    patientId: row.patient_id as string,
    rawTranscript: row.raw_transcript as string,
    structuredAnamnesis: row.structured_anamnesis as StructuredAnamnesis,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

// ─── PatientRepository ────────────────────────────────────────────────────────

export const PatientRepository = {
  async findAll(userId: string): Promise<Patient[]> {
    const { data } = await supabase
      .from('patients')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    return (data ?? []).map(toPatient)
  },

  async findById(userId: string, id: string): Promise<Patient | null> {
    const { data } = await supabase
      .from('patients')
      .select('*')
      .eq('user_id', userId)
      .eq('id', id)
      .single()
    return data ? toPatient(data) : null
  },

  async findByCPF(userId: string, cpf: string): Promise<Patient | null> {
    const { data } = await supabase
      .from('patients')
      .select('*')
      .eq('user_id', userId)
      .eq('cpf', cpf)
      .single()
    return data ? toPatient(data) : null
  },

  async findByExternalId(userId: string, externalId: string): Promise<Patient | null> {
    const { data } = await supabase
      .from('patients')
      .select('*')
      .eq('user_id', userId)
      .eq('external_id', externalId)
      .maybeSingle()
    return data ? toPatient(data) : null
  },

  async search(userId: string, query: string): Promise<Patient[]> {
    const safe = query.replace(/[%_,()]/g, '')
    const { data } = await supabase
      .from('patients')
      .select('*')
      .eq('user_id', userId)
      .or(`name.ilike.%${safe}%,cpf.ilike.%${safe}%`)
      .order('created_at', { ascending: false })
    return (data ?? []).map(toPatient)
  },

  async findAllWithStats(userId: string, limit = 100): Promise<PatientWithStats[]> {
    // Query 1: patients with consultation count
    const { data: patients, error: err1 } = await supabase
      .from('patients')
      .select('*, consultations(count)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (err1) console.error('[findAllWithStats] query1 error:', err1)

    // Query 2: latest consultation date per patient + presença de anamnese
    const { data: latestConsultations, error: err2 } = await supabase
      .from('consultations')
      .select('patient_id, created_at, structured_anamnesis')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (err2) console.error('[findAllWithStats] query2 error:', err2)

    // Build a map: patientId -> latest created_at; e set de quem tem anamnese gerada
    const latestDateMap = new Map<string, string>()
    const anamnesisSet = new Set<string>()
    for (const c of latestConsultations ?? []) {
      if (!latestDateMap.has(c.patient_id)) {
        latestDateMap.set(c.patient_id, c.created_at)
      }
      if (c.structured_anamnesis != null) {
        anamnesisSet.add(c.patient_id)
      }
    }

    return (patients ?? []).map((row) => {
      const consultations = row.consultations as { count: number }[]
      return {
        ...toPatient(row),
        consultationCount: consultations[0]?.count ?? 0,
        lastConsultationAt: latestDateMap.get(row.id),
        hasAnamnesis: anamnesisSet.has(row.id),
      }
    })
  },

  async save(userId: string, patient: Patient): Promise<void> {
    const { error } = await supabase.from('patients').upsert({
      id: patient.id,
      user_id: userId,
      name: patient.name,
      cpf: patient.cpf,
      birth_date: patient.birthDate ?? null,
      phone: patient.phone ?? null,
      external_id: patient.externalId ?? null,
    })
    if (error) throw new Error(error.message)
  },

  async update(userId: string, id: string, data: Partial<Pick<Patient, 'name' | 'cpf' | 'birthDate' | 'phone' | 'externalId'>>): Promise<void> {
    await supabase
      .from('patients')
      .update({
        name: data.name,
        cpf: data.cpf,
        birth_date: data.birthDate ?? null,
        phone: data.phone ?? null,
        external_id: data.externalId ?? null,
      })
      .eq('user_id', userId)
      .eq('id', id)
  },

  async delete(userId: string, id: string): Promise<void> {
    await supabase
      .from('patients')
      .delete()
      .eq('user_id', userId)
      .eq('id', id)
  },
}

// ─── ConsultationRepository ───────────────────────────────────────────────────

export const ConsultationRepository = {
  async findAll(
    userId: string,
    { limit = 20, offset = 0 }: { limit?: number; offset?: number } = {},
  ): Promise<Consultation[]> {
    const { data } = await supabase
      .from('consultations')
      .select('*')
      .eq('user_id', userId)
      .not('structured_anamnesis', 'is', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    return (data ?? []).map(toConsultation)
  },

  async findLatestByPatientId(userId: string, patientId: string): Promise<Consultation | null> {
    // Só consultas com anamnese gerada — "Ver anamnese" nunca deve abrir um atendimento
    // abandonado/em andamento (que não tem structured_anamnesis) e cair em 404.
    const { data } = await supabase
      .from('consultations')
      .select('*')
      .eq('user_id', userId)
      .eq('patient_id', patientId)
      .not('structured_anamnesis', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return data ? toConsultation(data) : null
  },

  findByPatientId(userId: string, patientId: string): Promise<Consultation | null> {
    return ConsultationRepository.findLatestByPatientId(userId, patientId)
  },

  async countByPeriod(userId: string, period: 'today' | 'week' | 'month'): Promise<number> {
    const now = new Date()
    let since: Date

    if (period === 'today') {
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    } else if (period === 'week') {
      const day = now.getDay()
      const diff = day === 0 ? -6 : 1 - day
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff)
    } else {
      since = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    const { data } = await supabase
      .from('consultations')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', since.toISOString())
      .not('structured_anamnesis', 'is', null)

    return (data ?? []).length
  },

  async save(userId: string, consultation: Consultation): Promise<{ id: string }> {
    const { data, error } = await supabase.from('consultations').upsert(
      {
        user_id: userId,
        patient_id: consultation.patientId,
        raw_transcript: null,
        structured_anamnesis: consultation.structuredAnamnesis,
        status: 'completed',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,patient_id' },
    ).select('id').single()
    if (error) throw new Error(error.message)
    return { id: (data as { id: string } | null)?.id ?? '' }
  },
}
