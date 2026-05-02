import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db/prisma'
import type { UserRole } from '@prisma/client'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: UserRole
    }
  }
  interface User {
    role: UserRole
  }
  interface JWT {
    id?: string
    role?: UserRole
    email?: string
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // 生产环境务必设置与浏览器一致的应用根 URL：AUTH_URL（或 AUTH_TRUST_HOST=true，见 .env.example）
  trustHost: process.env.AUTH_TRUST_HOST === 'true',
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/zh/login',
    error: '/zh/login',
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const emailNorm = (credentials.email as string).trim().toLowerCase()
        const user = await prisma.user.findFirst({
          where: { email: { equals: emailNorm, mode: 'insensitive' } },
        })

        if (!user) return null
        if (!user.emailVerified) return null

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash,
        )
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.nameEn,
          role: user.role,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.email = user.email ?? undefined
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as UserRole
        if (token.email) session.user.email = token.email as string
      }
      return session
    },
  },
})
