import Link from 'next/link'
import type { AccountApprovalStatus } from '@prisma/client'
import { SFS_SALES_MAILTO_APPROVAL } from '@/lib/sfs/sales-contact'

const GOLD = '#C9A96E'
const DARK = '#1A1A1A'
const MUTED = '#6B5E4A'
const BG = '#FAFAF8'

export default function SfsPendingApprovalNotice({
  status,
  name,
}: {
  status: AccountApprovalStatus
  name?: string | null
}) {
  const rejected = status === 'REJECTED'

  return (
    <div className="min-h-screen" style={{ background: BG }}>
      <main className="max-w-lg mx-auto px-6 py-16">
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: '#FFFFFF', border: '1px solid #EDE7D8', boxShadow: '0 1px 12px rgba(0,0,0,0.04)' }}
        >
          <p className="text-xs uppercase tracking-[0.22em] mb-4" style={{ color: GOLD }}>
            {rejected ? 'Access Not Approved' : 'Pending Approval'}
          </p>
          <h1 className="text-2xl font-bold mb-3" style={{ fontFamily: 'Georgia, serif', color: DARK }}>
            {rejected ? 'Your account needs assistance' : 'Thanks for registering'}
          </h1>
          <p className="text-sm leading-relaxed mb-6" style={{ color: MUTED }}>
            {rejected
              ? `${name ? `${name}, your` : 'Your'} SFS Diamond account was not approved for order details. Please contact our team if you believe this is a mistake.`
              : `${name ? `${name}, your` : 'Your'} account is waiting for staff approval. You can sign in, but order history and production details stay hidden until a distributor partnership is confirmed.`}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={SFS_SALES_MAILTO_APPROVAL}
              className="px-6 py-3 rounded-full text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: GOLD, color: '#0A0805' }}
            >
              Contact Partnership Team
            </a>
            <Link
              href="/sfsdiamond"
              className="px-6 py-3 rounded-full text-sm font-medium border transition-colors hover:bg-black/5"
              style={{ borderColor: GOLD, color: DARK }}
            >
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
