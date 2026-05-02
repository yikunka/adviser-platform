import { requireRole } from '@/lib/auth/rbac'
import { ingestAllSourcesFromLocalFiles } from '@/lib/aml/ingester'

export const maxDuration = 900

export async function POST() {
  const { error } = await requireRole('SUPER_ADMIN')
  if (error) return error

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        await ingestAllSourcesFromLocalFiles((event) => {
          controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' },
  })
}
