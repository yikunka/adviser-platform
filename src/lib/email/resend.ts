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
