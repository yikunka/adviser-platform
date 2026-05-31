import { PrismaClient } from '@prisma/client'

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Check .env / .env.local and restart the dev server.')
  }
  return new PrismaClient({
    datasourceUrl: connectionString,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

const globalForPrisma = global as unknown as {
  prisma?: PrismaClient
  prismaDatabaseUrl?: string
}

function getPrismaClient() {
  const url = process.env.DATABASE_URL
  if (
    globalForPrisma.prisma
    && globalForPrisma.prismaDatabaseUrl === url
  ) {
    return globalForPrisma.prisma
  }
  const client = createPrismaClient()
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = client
    globalForPrisma.prismaDatabaseUrl = url
  }
  return client
}

export const prisma = getPrismaClient()
