'use client'

import { useMemo } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface BirthDateSelectProps {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  disabled?: boolean
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: CURRENT_YEAR - 1899 }, (_, i) => CURRENT_YEAR - i)
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

export function BirthDateSelect({ value, onChange, onBlur, disabled }: BirthDateSelectProps) {
  const [day, month, year] = useMemo(() => {
    if (!value || value.length < 10) return ['', '', '']
    const [y, m, d] = value.split('-')
    return [
      d ? String(parseInt(d, 10)) : '',
      m ? String(parseInt(m, 10)) : '',
      y ?? '',
    ]
  }, [value])

  function assemble(next: { day: string; month: string; year: string }) {
    if (next.day && next.month && next.year) {
      const d = next.day.padStart(2, '0')
      const m = next.month.padStart(2, '0')
      onChange(`${next.year}-${m}-${d}`)
    } else {
      onChange('')
    }
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <Select
        value={day}
        onValueChange={val => assemble({ day: val, month, year })}
        onOpenChange={open => { if (!open) onBlur?.() }}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="Dia" />
        </SelectTrigger>
        <SelectContent>
          {DAYS.map(d => (
            <SelectItem key={d} value={String(d)}>
              {String(d).padStart(2, '0')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={month}
        onValueChange={val => assemble({ day, month: val, year })}
        onOpenChange={open => { if (!open) onBlur?.() }}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="Mês" />
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map((name, i) => (
            <SelectItem key={i + 1} value={String(i + 1)}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={year}
        onValueChange={val => assemble({ day, month, year: val })}
        onOpenChange={open => { if (!open) onBlur?.() }}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="Ano" />
        </SelectTrigger>
        <SelectContent>
          {YEARS.map(y => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
