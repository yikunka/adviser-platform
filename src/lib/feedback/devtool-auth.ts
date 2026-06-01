import { createHash, randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/feedback/adapter'

export function hashKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

export function generateRawKey(): string {
  return randomBytes(32).toString('hex')
}

export async function requireDevtoolKey(
  req: NextRequest,
): Promise<{ error: NextResponse } | { error: null }> {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) {
    return {
      error: NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 }),
    }
  }

  const config = await prisma.feedbackConfig.findUnique({ where: { id: 'singleton' } })
  if (!config?.devtoolKeyHash || config.devtoolKeyHash !== hashKey(token)) {
    return {
      error: NextResponse.json({ error: 'Invalid API key' }, { status: 401 }),
    }
  }

  return { error: null }
}
