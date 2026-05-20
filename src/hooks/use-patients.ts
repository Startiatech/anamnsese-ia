'use client'
import { useState, useCallback, useEffect } from 'react'
import { generateId } from '@/lib/utils'
import { API } from '@/lib/routes'
import type { Patient } from '@/types'

interface CreatePatientInput {
  name: string
  cpf: string
  birthDate?: string
  phone?: string
}

export function usePatients() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [search, setSearch] = useState('')
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([])

  const refresh = useCallback(async () => {
    const res = await fetch(API.patients)
    if (!res.ok) return
    const data: Patient[] = await res.json()
    setPatients(data)
    setFilteredPatients(data)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!search.trim()) {
      setFilteredPatients(patients)
      return
    }
    const q = encodeURIComponent(search)
    fetch(`${API.patients}?q=${q}`)
      .then((r) => r.json())
      .then(setFilteredPatients)
  }, [search, patients])

  const createPatient = useCallback(async (input: CreatePatientInput): Promise<Patient> => {
    const patient: Patient = {
      id: generateId(),
      ...input,
      createdAt: new Date().toISOString(),
    }
    await fetch(API.patients, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patient),
    })
    await refresh()
    return patient
  }, [refresh])

  return { patients, filteredPatients, search, setSearch, createPatient, refresh }
}
