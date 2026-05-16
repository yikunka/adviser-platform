import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db/prisma'
import type { UserRole, Platform } from '@prisma/client'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: UserRole
      platform: Platform
    }
  }
  interface User {
    role: UserRole
    platform: Platform
  }
  interface JWT {
    id?: string
    role?: UserRole
    platform?: Platform
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
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
        // Which platform is this login coming from — defaults to ADVISER
        platform: { label: 'Platform', type: 'text'     },
        adminLogin: { label: 'Admin login', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const emailNorm  = (credentials.email as string).trim().toLowerCase()
        const reqPlatform = (credentials.platform as Platform | undefined) ?? 'ADVISER'

        const user = await prisma.user.findFirst({
          where: { email: { equals: emailNorm, mode: 'insensitive' } },
        })

        if (!user) return null
        if (!user.emailVerified) return null
        if (!user.isActive) return null

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash,
        )
        if (!valid) return null

        const adminLogin = credentials.adminLogin === '1' || credentials.adminLogin === 'true'
        if (adminLogin && user.role === 'CLIENT') return null

        // Staff / admin accounts always log in via the Adviser panel — skip platform check
        const isStaff = user.role !== 'CLIENT'
        if (!isStaff && user.platform !== reqPlatform) return null

        return {
          id:       user.id,
          email:    user.email,
          name:     user.nameEn,
          role:     user.role,
          platform: user.platform,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id       = user.id
        token.role     = user.role
        token.platform = user.platform
        token.email    = user.email ?? undefined
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id       = token.id as string
        session.user.role     = token.role as UserRole
        session.user.platform = token.platform as Platform
        if (token.email) session.user.email = token.email as string
      }
      return session
    },
  },
})
