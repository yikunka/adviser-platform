import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Resend } from 'resend'

const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(255),
  phone: z.string().max(20).optional(),
  subject: z.string().min(1).max(200),
  message: z.string().min(10).max(2000),
  locale: z.enum(['zh', 'en']).default('zh'),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { name, email, phone, subject, message } = parsed.data
  const to = process.env.EMAIL_FROM ?? 'info@6amadvise.com'

  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? 'noreply@6amadvise.com',
    to,
    replyTo: email,
    subject: `[Contact] ${subject}`,
    html: `
      <p><strong>From:</strong> ${name} (${email})</p>
      ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
      <p><strong>Subject:</strong> ${subject}</p>
      <hr/>
      <p>${message.replace(/\n/g, '<br/>')}</p>
    `,
  })

  return NextResponse.json({ message: 'Sent' })
}
