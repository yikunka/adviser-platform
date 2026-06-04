import { createHash, randomBytes } from 'node:crypto'
import type { NextRequest, NextResponse } from 'next/server'
import type { FeedbackDb } from '../types'

export function hashKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

export function generateRawKey(): string {
  return randomBytes(32).toString('hex')
}

export async function requireDevtoolKey(
  req: NextRequest,
  db: FeedbackDb,
): Promise<{ error: NextResponse } | { error: null }> {
  const { NextResponse: NR } = await import('next/server')
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return { error: NR.json({ error: 'Missing Authorization header' }, { status: 401 }) }

  const config = await db.feedbackConfig.findUnique({ where: { id: 'singleton' } }) as { devtoolKeyHash?: string } | null
  if (!config?.devtoolKeyHash || config.devtoolKeyHash !== hashKey(token)) {
    return { error: NR.json({ error: 'Invalid API key' }, { status: 401 }) }
  }
  return { error: null }
}
