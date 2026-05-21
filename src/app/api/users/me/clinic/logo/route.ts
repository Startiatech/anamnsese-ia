import { NextResponse } from 'next/server'
import { getServerUser } from '@/server/services/session'
import { supabase } from '@/server/supabase'
import { updateClinicLogo, clearClinicLogo, findUserById } from '@/server/repositories/users'

const BUCKET = 'clinic-logos'
const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}

export async function POST(req: Request) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let form: FormData
  try { form = await req.formData() } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'file required' }, { status: 400 })

  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: 'unsupported media type' }, { status: 415 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'file too large' }, { status: 413 })
  }

  // deleta logo anterior se existir
  const current = await findUserById(user.sub)
  if (current?.clinicLogoPath) {
    await supabase.storage.from(BUCKET).remove([current.clinicLogoPath])
  }

  const ext = EXT_BY_MIME[file.type] ?? 'bin'
  const path = `${user.sub}/${Date.now()}.${ext}`
  const bytes = new Uint8Array(await file.arrayBuffer())
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type, upsert: false,
  })
  if (upErr) {
    return NextResponse.json({ error: 'upload failed' }, { status: 500 })
  }
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
  await updateClinicLogo(user.sub, { url: pub.publicUrl, path })
  return NextResponse.json({ url: pub.publicUrl, path }, { status: 200 })
}

export async function DELETE(req: Request) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const current = await findUserById(user.sub)
  if (current?.clinicLogoPath) {
    await supabase.storage.from(BUCKET).remove([current.clinicLogoPath])
  }
  await clearClinicLogo(user.sub)
  return new NextResponse(null, { status: 204 })
}
