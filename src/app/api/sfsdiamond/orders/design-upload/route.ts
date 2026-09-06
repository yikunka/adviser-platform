import { NextRequest, NextResponse } from 'next/server'
import { uploadSfsDesignFile } from '@/lib/sfs/design-uploads'

export async function POST(req: NextRequest) {
  const formData = await req.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  try {
    const uploaded = await uploadSfsDesignFile(file)
    return NextResponse.json(uploaded, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    const status = message.includes('OSS') || message.includes('storage') ? 503 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
