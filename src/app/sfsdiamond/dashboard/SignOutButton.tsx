'use client'

export default function SignOutButton() {
  return (
    <button
      onClick={() => import('next-auth/react').then(m => m.signOut({ callbackUrl: '/sfsdiamond/login' }))}
      className="text-sm font-medium px-4 py-2 rounded-full border transition-all hover:bg-black/5"
      style={{ border: '1px solid #EDE7D8', color: '#6B5E4A' }}
    >
      Sign out
    </button>
  )
}
