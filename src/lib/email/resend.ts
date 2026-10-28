import { Resend } from 'resend'
import {
  SFS_PUBLIC_WEBSITE,
  SFS_SALES_CONTACT_LINE,
} from '@/lib/sfs/sales-contact'

let _resend: Resend | null = null
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

const FROM = process.env.EMAIL_FROM ?? 'noreply@6amadvise.com'

const DEV_NO_EMAIL = !process.env.RESEND_API_KEY

function sfsPartnerLoginUrl() {
  return `${SFS_PUBLIC_WEBSITE}/sfsdiamond/login`
}

function sfsOrderUrl(orderId: string) {
  return `${SFS_PUBLIC_WEBSITE}/sfsdiamond/dashboard/${orderId}`
}

export async function sendOTPEmail(to: string, otp: string, locale: string = 'zh') {
  if (DEV_NO_EMAIL) {
    console.log(`[DEV] OTP email skipped — RESEND_API_KEY not set. OTP for ${to}: ${otp}`)
    return { data: null, error: null }
  }

  const subject = locale === 'zh' ? '電郵驗證碼' : 'Email Verification Code'
  const body =
    locale === 'zh'
      ? `<p>您的驗證碼為：<strong>${otp}</strong>，有效期 10 分鐘。</p>`
      : `<p>Your verification code is: <strong>${otp}</strong>. Valid for 10 minutes.</p>`

  return getResend().emails.send({ from: FROM, to, subject, html: body })
}

export async function sendPasswordResetEmail(to: string, link: string, locale: string = 'zh') {
  if (DEV_NO_EMAIL) {
    console.log(`[DEV] Password reset email skipped — RESEND_API_KEY not set. Link: ${link}`)
    return { data: null, error: null }
  }

  const subject = locale === 'zh' ? '重設密碼' : 'Reset Your Password'
  const body =
    locale === 'zh'
      ? `<p>請點擊以下連結重設您的密碼（有效期 1 小時）：</p><p><a href="${link}">${link}</a></p>`
      : `<p>Click the link below to reset your password (valid for 1 hour):</p><p><a href="${link}">${link}</a></p>`

  return getResend().emails.send({ from: FROM, to, subject, html: body })
}

export async function sendSfsPartnerApprovalEmail(
  to: string,
  status: 'APPROVED' | 'REJECTED',
  partnerName?: string | null,
) {
  const name = partnerName?.trim() || 'Partner'
  if (DEV_NO_EMAIL) {
    console.log(`[DEV] SFS partner ${status} email skipped for ${to} (${name})`)
    return { data: null, error: null }
  }

  if (status === 'APPROVED') {
    return getResend().emails.send({
      from: FROM,
      to,
      subject: 'SFS Diamond — partner account approved',
      html: `<p>Hello ${name},</p>
<p>Your SFS Diamond distributor account is approved. You can sign in and place orders here:</p>
<p><a href="${sfsPartnerLoginUrl()}">Partner login</a></p>
<p>Sales contact: ${SFS_SALES_CONTACT_LINE}</p>`,
    })
  }

  return getResend().emails.send({
    from: FROM,
    to,
    subject: 'SFS Diamond — partner application update',
    html: `<p>Hello ${name},</p>
<p>Your SFS Diamond partner application was not approved. If you believe this is a mistake, contact our sales manager:</p>
<p>${SFS_SALES_CONTACT_LINE}</p>`,
  })
}

export async function sendSfsQuoteReadyEmail(
  to: string,
  opts: {
    partnerName?: string | null
    orderId: string
    sampleCode?: string | null
    memorialName: string
    quotedAmount?: number | null
  },
) {
  const name = opts.partnerName?.trim() || 'Partner'
  const orderLabel = opts.sampleCode?.trim() || opts.memorialName
  const amountLine =
    opts.quotedAmount != null
      ? `<p>Quoted amount: <strong>HK$${Number(opts.quotedAmount).toLocaleString('en-HK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</strong></p>`
      : ''
  if (DEV_NO_EMAIL) {
    console.log(`[DEV] SFS quote email skipped for ${to} (${orderLabel})`)
    return { data: null, error: null }
  }

  return getResend().emails.send({
    from: FROM,
    to,
    subject: `SFS Diamond — quote ready (${orderLabel})`,
    html: `<p>Hello ${name},</p>
<p>A quotation is ready for order <strong>${orderLabel}</strong> (${opts.memorialName}).</p>
${amountLine}
<p><a href="${sfsOrderUrl(opts.orderId)}">Review and accept or request a change</a></p>
<p>Sales contact: ${SFS_SALES_CONTACT_LINE}</p>`,
  })
}

export async function sendSfsProductionImageEmail(
  to: string,
  opts: {
    partnerName?: string | null
    orderId: string
    sampleCode?: string | null
    memorialName: string
  },
) {
  const name = opts.partnerName?.trim() || 'Partner'
  const orderLabel = opts.sampleCode?.trim() || opts.memorialName
  if (DEV_NO_EMAIL) {
    console.log(`[DEV] SFS production image email skipped for ${to} (${orderLabel})`)
    return { data: null, error: null }
  }

  return getResend().emails.send({
    from: FROM,
    to,
    subject: `SFS Diamond — production image ready (${orderLabel})`,
    html: `<p>Hello ${name},</p>
<p>A new production image is ready to view for order <strong>${orderLabel}</strong> (${opts.memorialName}).</p>
<p><a href="${sfsOrderUrl(opts.orderId)}">Open order</a></p>
<p>Sales contact: ${SFS_SALES_CONTACT_LINE}</p>`,
  })
}
