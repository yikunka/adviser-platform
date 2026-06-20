import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db/prisma'
import type { UserRole, Platform } from '@prisma/client'
import { CredentialsSignin } from 'next-auth'
import {
  AdminOnlyLoginError,
  AuthSystemError,
  EmailNotVerifiedError,
  InactiveAccountError,
  PlatformMismatchLoginError,
} from '@/lib/auth/login-errors'

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
  // Production commonly runs behind nginx/PM2; trust the forwarded Host so Auth.js
  // does not reject the public domain before session lookup.
  trustHost: process.env.AUTH_TRUST_HOST === 'true' || process.env.NODE_ENV === 'production',
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
        const adminLogin = credentials.adminLogin === '1' || credentials.adminLogin === 'true'
        try {
          const user = await prisma.user.findFirst({
            where: { email: { equals: emailNorm, mode: 'insensitive' } },
          })

          if (!user) return null
          if (!user.emailVerified) throw new EmailNotVerifiedError()
          if (!user.isActive) throw new InactiveAccountError()

          const valid = await bcrypt.compare(
            credentials.password as string,
            user.passwordHash,
          )
          if (!valid) return null

          if (adminLogin && user.role === 'CLIENT') throw new AdminOnlyLoginError()

          // Staff / admin accounts always log in via the Adviser panel — skip platform check
          const isStaff = user.role !== 'CLIENT'
          if (!isStaff && user.platform !== reqPlatform) throw new PlatformMismatchLoginError()

          return {
            id:       user.id,
            email:    user.email,
            name:     user.nameEn,
            role:     user.role,
            platform: user.platform,
          }
        } catch (error) {
          if (error instanceof CredentialsSignin) throw error
          console.error('[auth] credentials authorize failed', {
            email: emailNorm,
            requestedPlatform: reqPlatform,
            adminLogin,
          }, error)
          throw new AuthSystemError(error instanceof Error ? error : undefined)
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
