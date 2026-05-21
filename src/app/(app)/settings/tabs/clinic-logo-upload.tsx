'use client'

import { useRef, useState } from 'react'
import { Upload, Trash2, ImagePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { API } from '@/lib/routes'

const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']

interface Props {
  value: string | null
  onChange: (url: string | null) => void
}

export function ClinicLogoUpload({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function handleFile(file: File) {
    if (!ALLOWED.includes(file.type)) {
      toast.error('Formato inválido. Use PNG, JPG, WEBP ou SVG.')
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error('Arquivo muito grande (máx 2MB).')
      return
    }
    setBusy(true)
    const fd = new FormData()
    fd.append('file', file)
    const promise = fetch(API.clinicLogo, { method: 'POST', body: fd }).then(async (r) => {
      if (!r.ok) throw new Error('Falha no upload')
      const body = await r.json() as { url: string }
      onChange(body.url)
    })
    toast.promise(promise, { loading: 'Aguarde...', success: 'Logo enviado.', error: 'Erro ao enviar logo.' })
    await promise.catch(() => {}).finally(() => setBusy(false))
  }

  async function handleRemove() {
    setBusy(true)
    const promise = fetch(API.clinicLogo, { method: 'DELETE' }).then((r) => {
      if (!r.ok && r.status !== 204) throw new Error('Falha ao remover')
      onChange(null)
    })
    toast.promise(promise, { loading: 'Aguarde...', success: 'Logo removido.', error: 'Erro ao remover logo.' })
    await promise.catch(() => {}).finally(() => setBusy(false))
  }

  return (
    <div className="flex items-center gap-4">
      <div className="w-24 h-24 rounded-xl border border-border bg-card flex items-center justify-center overflow-hidden">
        {value
          ? <img src={value} alt="Logo da clínica" className="w-full h-full object-contain" />
          : <ImagePlus className="h-8 w-8 text-muted-foreground" />}
      </div>
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          data-testid="logo-file-input"
          type="file"
          accept={ALLOWED.join(',')}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
            e.target.value = ''
          }}
        />
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Upload className="h-3.5 w-3.5 mr-1.5" />
          {value ? 'Trocar logo' : 'Enviar logo'}
        </Button>
        {value && (
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={handleRemove}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Remover
          </Button>
        )}
        <p className="text-[11px] text-muted-foreground">PNG, JPG, WEBP, SVG · máx 2MB</p>
      </div>
    </div>
  )
}
