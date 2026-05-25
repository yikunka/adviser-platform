import { NextRequest } from 'next/server'
import { signOut } from '@/lib/auth/auth'

export async function GET(req: NextRequest) {
  const callbackUrl = req.nextUrl.searchParams.get('callbackUrl') ?? '/zh/admin-login'
  await signOut({ redirectTo: callbackUrl })
}
