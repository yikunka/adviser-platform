/**
 * Feedback Plugin — System Adapter
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │  COPY THIS PLUGIN TO A NEW SYSTEM?                          │
 * │  This is the ONLY file you need to edit.                    │
 * │  Point the three imports below at your system's auth/db.    │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Requirements for the target system:
 *   - `auth()`        → returns null | { user: { id, name?, email?, role? } }
 *   - `prisma`        → a PrismaClient instance
 *   - A user role system where admins have role STAFF / SUPER_ADMIN (or adapt below)
 */

import { NextResponse } from 'next/server'

// ── 1. Auth session ────────────────────────────────────────────────────────
// Replace with your system's session function.
import { auth } from '@/lib/auth/auth'
export { auth }

// ── 2. Database client ─────────────────────────────────────────────────────
// Replace with your system's Prisma client.
import { prisma } from '@/lib/db/prisma'
export { prisma }

// ── 3. Admin access guard ──────────────────────────────────────────────────
// Adapt this function to your system's role model.
// Must return { error: NextResponse } when unauthorised, or { error: null } when OK.
import { requireRole } from '@/lib/auth/rbac'

type GuardResult = { error: NextResponse | null }

export async function requireFeedbackAccess(): Promise<GuardResult> {
  const { error } = await requireRole('STAFF')
  return { error }
}
