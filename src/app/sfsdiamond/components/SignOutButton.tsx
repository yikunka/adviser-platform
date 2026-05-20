'use client'

export default function SignOutButton({ dark = false }: { dark?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => import('next-auth/react').then(m => m.signOut({ callbackUrl: '/sfsdiamond/login' }))}
      className="text-sm font-medium px-4 py-1.5 rounded-full border transition-all duration-150 hover:opacity-70"
      style={
        dark
          ? { border: '1px solid rgba(201,169,110,0.40)', color: '#E8DFC8' }
          : { border: '1px solid #EDE7D8', color: '#6B5E4A' }
      }
    >
      Sign out
    </button>
  )
}
