import type { NextResponse } from 'next/server'

// ── Session ────────────────────────────────────────────────────────────────

export interface FeedbackSession {
  user: {
    id: string
    name?: string | null
    email?: string | null
  }
}

// ── Minimal DB interface ───────────────────────────────────────────────────
// Satisfied by any PrismaClient that has FeedbackConfig + FeatureRequest models.

export interface FeedbackDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  feedbackConfig: Record<string, (...args: any[]) => Promise<any>>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  featureRequest: Record<string, (...args: any[]) => Promise<any>>
}

// ── Upload result ──────────────────────────────────────────────────────────

export interface UploadResult {
  url: string
  name: string
  type: string
  key?: string
}

// ── Adapter ───────────────────────────────────────────────────────────────
//
// This is the ONLY interface you implement per system.
// Point getSession/db/requireAccess at your system's auth + Prisma,
// and optionally provide uploadFile for attachment support.

export interface FeedbackAdapter {
  /** Return the current user session, or null if unauthenticated. */
  getSession(): Promise<FeedbackSession | null>

  /** PrismaClient instance with FeedbackConfig + FeatureRequest models. */
  db: FeedbackDb

  /**
   * Return { error: null } for authorised requests, or
   * { error: NextResponse } (401/403) for unauthorised.
   */
  requireAccess(): Promise<{ error: NextResponse | null }>

  /**
   * Optional: handle file uploads. If omitted the /upload endpoint returns 501
   * and the attachment button is hidden in the widget.
   */
  uploadFile?(file: File, userId: string): Promise<UploadResult>

  /**
   * Optional: override the path to system-knowledge.md.
   * Defaults to 'src/lib/feedback/system-knowledge.md' relative to cwd.
   */
  knowledgePath?: string
}
