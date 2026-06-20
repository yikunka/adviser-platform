import { CredentialsSignin } from 'next-auth'

export type LoginFailureCode =
  | 'credentials'
  | 'inactive'
  | 'unverified'
  | 'admin_only'
  | 'platform_mismatch'
  | 'system'

class BaseLoginError extends CredentialsSignin {
  constructor(code: LoginFailureCode, cause?: Error) {
    super()
    this.code = code
    if (cause) {
      ;(this as Error & { cause?: { err: Error } }).cause = { err: cause }
    }
  }
}

export class InactiveAccountError extends BaseLoginError {
  constructor() {
    super('inactive')
  }
}

export class EmailNotVerifiedError extends BaseLoginError {
  constructor() {
    super('unverified')
  }
}

export class AdminOnlyLoginError extends BaseLoginError {
  constructor() {
    super('admin_only')
  }
}

export class PlatformMismatchLoginError extends BaseLoginError {
  constructor() {
    super('platform_mismatch')
  }
}

export class AuthSystemError extends BaseLoginError {
  constructor(cause?: Error) {
    super('system', cause)
  }
}

export function normalizeLoginFailureCode(
  error: string | undefined,
  code: string | undefined,
): LoginFailureCode {
  if (error !== 'CredentialsSignin') return 'system'
  switch (code) {
    case 'inactive':
    case 'unverified':
    case 'admin_only':
    case 'platform_mismatch':
    case 'system':
      return code
    case 'credentials':
    default:
      return 'credentials'
  }
}
