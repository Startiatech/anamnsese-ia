'use client'

import { useEffect, useState } from 'react'
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

function partsFromValue(value: string): { day: string; month: string; year: string } {
  if (!value || value.length < 10) return { day: '', month: '', year: '' }
  const [y, m, d] = value.split('-')
  return {
    day: d ? String(parseInt(d, 10)) : '',
    month: m ? String(parseInt(m, 10)) : '',
    year: y ?? '',
  }
}

export function BirthDateSelect({ value, onChange, onBlur, disabled }: BirthDateSelectProps) {
  const [parts, setParts] = useState(() => partsFromValue(value))

  useEffect(() => {
    const next = partsFromValue(value)
    setParts((prev) =>
      prev.day === next.day && prev.month === next.month && prev.year === next.year
        ? prev
        : next,
    )
  }, [value])

  const { day, month, year } = parts

  function update(next: { day: string; month: string; year: string }) {
    setParts(next)
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
        onValueChange={val => update({ day: val, month, year })}
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
        onValueChange={val => update({ day, month: val, year })}
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
        onValueChange={val => update({ day, month, year: val })}
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
