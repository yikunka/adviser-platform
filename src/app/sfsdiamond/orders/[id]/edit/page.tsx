import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import OrderWizard, { type WizardFormData } from '@/app/sfsdiamond/components/OrderWizard'
import { getSfsOrderSpecOptions } from '@/lib/sfs/diamond-spec-options-server'
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget'
import { getSfsAccountAccess } from '@/lib/sfs/account-approval'

const EDITABLE_STATUSES = ['PENDING', 'QUOTED', 'CANCELLED']

export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session) redirect('/sfsdiamond/login')
  if (session.user.platform !== 'SFS_DIAMOND') redirect('/sfsdiamond/login')

  const access = await getSfsAccountAccess(session.user.id, session.user.platform)
  if (!access.approved) redirect('/sfsdiamond/dashboard')

  const { id } = await params
  const [order, specOptions] = await Promise.all([
    prisma.sfsOrder.findUnique({
      where: { id },
      include: { designAttachments: { orderBy: [{ diamondIndex: 'asc' }, { uploadedAt: 'asc' }] } },
    }),
    getSfsOrderSpecOptions(),
  ])

  if (!order || order.userId !== session.user.id) notFound()
  if (!EDITABLE_STATUSES.includes(order.status)) redirect(`/sfsdiamond/dashboard/${id}`)

  // Unpack relationship field (e.g. "Pet — Fluffy" → relationship=Pet, relationshipPet=Fluffy)
  const rawRel = order.relationship ?? ''
  const isPet = rawRel.startsWith('Pet — ')
  const relationship    = isPet ? 'Pet' : rawRel
  const relationshipPet = isPet ? rawRel.slice(6) : ''

  const diamonds = order.diamonds as {
    carat?: string
    shape?: string
    type?: string
    ringSize?: string
    design?: string
    designNotes?: string
    metal?: string
  }[]

  const initialData: Partial<WizardFormData> = {
    memorialName:   order.memorialName,
    relationship,
    relationshipPet,
    clientName:     order.clientName,
    contactNumber:  order.contactNumber,
    email:          order.email,
    mailingAddress: order.mailingAddress,
    sourceType:     order.sourceType,
    sourceOther:    order.sourceOther ?? '',
    remarks:        order.remarks ?? '',
    mailingPackage: order.mailingPackage,
    color:          order.color,
    diamonds: diamonds.map((d, index) => ({
      carat:    d.carat    ?? '',
      shape:    d.shape    ?? '',
      type:     d.type     ?? '',
      ringSize: d.ringSize ?? '',
      design:   d.design   ?? '',
      designNotes: d.designNotes ?? '',
      designUploads: order.designAttachments
        .filter(a => a.diamondIndex === index)
        .map(a => ({
          attachmentId: a.id,
          fileName: a.fileName,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
        })),
      metal:    d.metal    ?? '',
    })),
  }

  return (
    <>
      <OrderWizard mode="edit" orderId={id} initialData={initialData} specOptions={specOptions} />
      <FeedbackWidget locale="en" />
    </>
  )
}
