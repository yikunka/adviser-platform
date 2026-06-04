import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createInterface } from 'node:readline'

// ── Colour helpers ─────────────────────────────────────────────────────────

const c = {
  bold:  (s: string) => `\x1b[1m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  cyan:  (s: string) => `\x1b[36m${s}\x1b[0m`,
  yellow:(s: string) => `\x1b[33m${s}\x1b[0m`,
  dim:   (s: string) => `\x1b[2m${s}\x1b[0m`,
  red:   (s: string) => `\x1b[31m${s}\x1b[0m`,
}

function log(msg: string) { console.log(msg) }
function ok(msg: string)  { console.log(`  ${c.green('✓')} ${msg}`) }
function warn(msg: string){ console.log(`  ${c.yellow('!')} ${msg}`) }

// ── Prompt helper ──────────────────────────────────────────────────────────

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer.trim()) }))
}

// ── File writer ────────────────────────────────────────────────────────────

function write(filePath: string, content: string, overwrite = false) {
  if (existsSync(filePath) && !overwrite) {
    warn(`Skipped (already exists): ${filePath}`)
    return false
  }
  mkdirSync(filePath.replace(/\/[^/]+$/, ''), { recursive: true })
  writeFileSync(filePath, content, 'utf-8')
  ok(filePath)
  return true
}

// ── Template generators ────────────────────────────────────────────────────

function adapterTemplate() {
  return `import type { FeedbackAdapter } from 'sharecto'
import { NextResponse } from 'next/server'

// ── Replace these three imports with your system's auth/db ─────────────────
import { auth }        from '@/lib/auth/auth'    // returns null | { user: { id, name?, email? } }
import { prisma }      from '@/lib/db/prisma'    // PrismaClient with FeedbackConfig + FeatureRequest
import { requireRole } from '@/lib/auth/rbac'    // returns { error: NextResponse | null }
// ──────────────────────────────────────────────────────────────────────────

export const adapter: FeedbackAdapter = {
  getSession: () => auth(),

  db: prisma,

  async requireAccess() {
    // Adapt to your role model — anything that returns { error: null } when OK
    const { error } = await requireRole('STAFF')
    return { error: error as NextResponse | null }
  },

  // Optional: remove this if you don't need file attachments
  // async uploadFile(file, userId) {
  //   // Store the file somewhere and return { url, name, type }
  //   throw new Error('uploadFile not implemented')
  // },

  knowledgePath: 'src/lib/feedback/system-knowledge.md',
}
`
}

function routeTemplate(factory: string, method: string, importPath: string) {
  return `import { ${factory} } from 'sharecto/routes'
import { adapter } from '@/lib/feedback/adapter'

const handler = ${factory}(adapter)
export const ${method} = handler.${method}
`
}

function adminIdRouteTemplate() {
  return `import { createAdminIdRoute } from 'sharecto/routes'
import { adapter } from '@/lib/feedback/adapter'

const handler = createAdminIdRoute(adapter)
export const GET   = handler.GET
export const PATCH = handler.PATCH
`
}

function adminConfigRouteTemplate() {
  return `import { createAdminConfigRoute } from 'sharecto/routes'
import { adapter } from '@/lib/feedback/adapter'

const handler = createAdminConfigRoute(adapter)
export const GET   = handler.GET
export const PATCH = handler.PATCH
export const POST  = handler.POST
`
}

function systemKnowledgeTemplate(appName: string) {
  return `# ${appName} — System Knowledge

> This file is read by the AI requirements assistant every time a user opens the widget.
> Keep it up-to-date as you ship features. See sharecto docs for guidelines.

## Overview
${appName} is a web application. (Replace this with a 1-2 sentence description.)

## Features

### Example Module (\`/admin/example\`)
- List, create, edit, delete records
- Supports filtering by status

<!-- Add more modules here as you build them -->
`
}

function prismaSchemaSnippet() {
  return `
// ── Add these models to your prisma/schema.prisma ─────────────────────────

enum FeatureRequestStatus {
  PENDING
  IN_PROGRESS
  DONE
  REJECTED
}

model FeedbackConfig {
  id             String   @id @default("singleton")
  provider       String   @default("anthropic")
  model          String   @default("claude-opus-4-5")
  anthropicKey   String   @default("")
  deepseekKey    String   @default("")
  alibabaKey     String   @default("")
  devtoolKeyHash String   @default("")
  updatedAt      DateTime @updatedAt
  @@map("adv_feedback_config")
}

model FeatureRequest {
  id           String               @id @default(cuid())
  pageUrl      String
  pageTitle    String               @default("")
  title        String               @default("")
  summary      String
  priority     String               @default("medium")
  conversation Json
  attachments  Json                 @default("[]")
  status       FeatureRequestStatus @default(PENDING)
  userId       String?
  userEmail    String?
  userName     String?
  createdAt    DateTime             @default(now())
  updatedAt    DateTime             @updatedAt
  @@index([status, createdAt])
  @@map("adv_feature_requests")
}
`
}

// ── Init command ───────────────────────────────────────────────────────────

async function runInit(cwd: string) {
  log('')
  log(c.bold('  sharecto init'))
  log(c.dim('  AI-powered requirements widget setup'))
  log('')

  // Detect Next.js project
  const hasNext = existsSync(join(cwd, 'next.config.ts')) || existsSync(join(cwd, 'next.config.js')) || existsSync(join(cwd, 'next.config.mjs'))
  if (!hasNext) {
    warn('next.config.* not found — make sure you\'re in a Next.js project root.')
  }

  // Ask for app name
  const appName = await prompt(c.cyan('  App name (for system-knowledge.md): '))
  const name = appName || 'My App'

  // Ask for src dir
  const srcAnswer = await prompt(c.cyan('  Source directory [src]: '))
  const srcDir = srcAnswer || 'src'

  // Warn if overwriting
  const adapterPath = join(cwd, srcDir, 'lib/feedback/adapter.ts')
  if (existsSync(adapterPath)) {
    const answer = await prompt(c.yellow(`  adapter.ts already exists. Overwrite? [y/N]: `))
    if (answer.toLowerCase() !== 'y') {
      log(c.dim('  Skipping adapter.ts — edit it manually if needed.'))
    }
  }

  log('')
  log(c.bold('  Creating files…'))

  const s = (p: string) => join(cwd, srcDir, p)
  const app = (p: string) => join(cwd, srcDir, 'app', p)

  // Adapter
  write(s('lib/feedback/adapter.ts'), adapterTemplate())

  // System knowledge
  write(s('lib/feedback/system-knowledge.md'), systemKnowledgeTemplate(name))

  // API routes
  write(app('api/feedback/chat/route.ts'),         routeTemplate('createChatRoute',        'POST',  ''))
  write(app('api/feedback/submit/route.ts'),        routeTemplate('createSubmitRoute',      'POST',  ''))
  write(app('api/feedback/upload/route.ts'),        routeTemplate('createUploadRoute',      'POST',  ''))
  write(app('api/admin/feedback/route.ts'),         routeTemplate('createAdminRoute',       'GET',   ''))
  write(app('api/admin/feedback/[id]/route.ts'),    adminIdRouteTemplate())
  write(app('api/admin/feedback/config/route.ts'),  adminConfigRouteTemplate())

  // Prisma schema snippet
  write(join(cwd, 'prisma/sharecto-schema-snippet.prisma'), prismaSchemaSnippet())

  log('')
  log(c.bold('  ─────────────────────────────────────────'))
  log(c.bold('  Finish setup — 4 manual steps remaining:'))
  log(c.bold('  ─────────────────────────────────────────'))
  log('')
  log(`  ${c.cyan('①')} ${c.bold('Edit adapter.ts')} — point the 3 imports at your auth/db:`)
  log(c.dim(`     ${srcDir}/lib/feedback/adapter.ts`))
  log('')
  log(`  ${c.cyan('②')} ${c.bold('Add Prisma models')} — copy from:`)
  log(c.dim('     prisma/sharecto-schema-snippet.prisma → prisma/schema.prisma'))
  log(c.dim('     then run: npx prisma migrate dev --name add_sharecto'))
  log('')
  log(`  ${c.cyan('③')} ${c.bold('Add widget to your layout')}:`)
  log(c.dim(`     import { FeedbackWidget } from 'sharecto/widget'`))
  log(c.dim(`     // In layout JSX: <FeedbackWidget />`))
  log('')
  log(`  ${c.cyan('④')} ${c.bold('Set env var')} (at least one):`)
  log(c.dim('     ANTHROPIC_API_KEY=sk-ant-...'))
  log(c.dim('     DEEPSEEK_API_KEY=sk-...'))
  log(c.dim('     ALIBABA_API_KEY=sk-...'))
  log('')
  log(`  ${c.cyan('⑤')} ${c.bold('Write system-knowledge.md')} — describe your app:`)
  log(c.dim(`     ${srcDir}/lib/feedback/system-knowledge.md`))
  log('')
  log(c.green('  Done! Run your app and look for the 提交需求 button.'))
  log('')
}

// ── Entry point ────────────────────────────────────────────────────────────

const [,, command, ...args] = process.argv
const cwd = args.find(a => a.startsWith('--cwd='))?.slice(6) ?? resolve(process.cwd())

if (command === 'init') {
  runInit(cwd).catch(err => {
    console.error(c.red('Error: ') + (err instanceof Error ? err.message : String(err)))
    process.exit(1)
  })
} else {
  log('')
  log(c.bold('  sharecto') + c.dim(' — AI requirements widget'))
  log('')
  log('  Usage:')
  log(c.cyan('    npx sharecto init') + c.dim('           # Set up in current directory'))
  log(c.cyan('    npx sharecto init --cwd=./app') + c.dim(' # Set up in a specific directory'))
  log('')
}
