import Link from 'next/link'
import OrderWizard from '@/app/sfsdiamond/components/OrderWizard'
import { auth } from '@/lib/auth/auth'
import { getSfsAccountAccess } from '@/lib/sfs/account-approval'
import { getSfsOrderSpecOptions } from '@/lib/sfs/diamond-spec-options-server'
import { SFS_SALES_MAILTO_PARTNERSHIP } from '@/lib/sfs/sales-contact'

function PartnerApply({ state }: { state: 'guest' | 'pending' | 'rejected' }) {
  const title = state === 'pending'
    ? 'Waiting for approval'
    : state === 'rejected'
      ? 'This account was not approved'
      : 'Orders are for approved distributors'
  const body = state === 'pending'
    ? 'Your account is in. Order details and the order form stay closed until our team approves the partnership.'
    : state === 'rejected'
      ? 'Please contact the factory if you believe this is a mistake.'
      : 'This is not a public checkout. Apply with your company and market, or sign in if you are already an approved partner.'
  return (
    <section className="py-24" style={{ background: '#FAFAF8' }}>
      <div className="max-w-xl mx-auto px-6 text-center">
        <p className="text-xs uppercase tracking-widest mb-4" style={{ color: '#C9A96E' }}>Partner order portal</p>
        <h1 className="text-3xl md:text-4xl font-bold mb-5" style={{ fontFamily: 'Georgia, serif', color: '#1A1A1A' }}>
          {title}
        </h1>
        <p className="text-sm leading-relaxed mb-8" style={{ color: '#4A3E30' }}>{body}</p>
        <div className="flex flex-wrap justify-center gap-3">
          {state === 'guest' ? (
            <Link
              href="/sfsdiamond/login"
              className="px-7 py-3 rounded-full text-sm font-semibold"
              style={{ background: '#C9A96E', color: '#0A0805' }}
            >
              Partner login
            </Link>
          ) : null}
          {state === 'rejected' ? null : (
            <Link
              href="/sfsdiamond/register"
              className="px-7 py-3 rounded-full text-sm font-medium border"
              style={{ border: '1px solid #C9A96E', color: '#1A1A1A' }}
            >
              Apply for a partner account
            </Link>
          )}
          <a
            href={SFS_SALES_MAILTO_PARTNERSHIP}
            className="px-7 py-3 rounded-full text-sm font-medium border"
            style={{ border: '1px solid #C9A96E', color: '#1A1A1A' }}
          >
            Email the factory
          </a>
        </div>
      </div>
    </section>
  )
}

export default async function SFSOrderPage() {
  const session = await auth()
  const isSfs = session?.user?.platform === 'SFS_DIAMOND'
  if (!isSfs || !session) return <PartnerApply state="guest" />

  const access = await getSfsAccountAccess(session.user.id, session.user.platform)
  if (!access.approved) return <PartnerApply state={access.status === 'REJECTED' ? 'rejected' : 'pending'} />

  const specOptions = await getSfsOrderSpecOptions()
  return <OrderWizard mode="create" specOptions={specOptions} />
}
