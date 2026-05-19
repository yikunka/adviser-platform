import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { requireRole } from '@/lib/auth/rbac'
import { ossImg } from '@/lib/oss-img'
import { uploadToR2 } from '@/lib/storage/r2'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 8 * 1024 * 1024

export async function POST(req: NextRequest) {
  const { error } = await requireRole('STAFF')
  if (error) return error

  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Only JPG, PNG, and WEBP images are allowed.' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large. Max 8MB.' }, { status: 400 })
  }

  const ext = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp'
  const key = `cosmocoat/products/${crypto.randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  await uploadToR2(key, buffer, file.type)

  const imagePath = `/${key}`
  return NextResponse.json({ imagePath, imageUrl: ossImg(imagePath, { w: 800 }) }, { status: 201 })
}
