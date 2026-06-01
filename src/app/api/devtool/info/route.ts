import { NextResponse } from 'next/server'
import { prisma } from '@/lib/feedback/adapter'

// GET /api/devtool/info
// Public endpoint — no auth required.
// Dev tools probe this to discover whether a server has the feedback plugin.
export async function GET() {
  const config = await prisma.feedbackConfig.findUnique({ where: { id: 'singleton' } })
  return NextResponse.json({
    plugin: 'adviser-feedback',
    version: '1.0.0',
    hasApiKey: !!(config?.devtoolKeyHash),
    endpoints: {
      requirements: '/api/devtool/requirements',
      requirement:  '/api/devtool/requirements/:id',
    },
  })
}
