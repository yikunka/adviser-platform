import { Resend } from 'resend'

let _resend: Resend | null = null
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

const FROM = process.env.EMAIL_FROM ?? 'noreply@6amadvise.com'

const DEV_NO_EMAIL = !process.env.RESEND_API_KEY

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
<p><a href="https://sfsdiamond.com/sfsdiamond/login">Partner login</a></p>
<p>Sales contact: +86 19129444364 (phone / WhatsApp) · patricklau@sfsdiamonds.com</p>`,
    })
  }

  return getResend().emails.send({
    from: FROM,
    to,
    subject: 'SFS Diamond — partner application update',
    html: `<p>Hello ${name},</p>
<p>Your SFS Diamond partner application was not approved. If you believe this is a mistake, contact our sales manager:</p>
<p>+86 19129444364 (phone / WhatsApp) · patricklau@sfsdiamonds.com</p>`,
  })
}
