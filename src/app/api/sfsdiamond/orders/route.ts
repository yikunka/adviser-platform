import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { getSfsOrderSpecOptions, type SfsSpecOption } from '@/lib/sfs/diamond-spec-options'
import { z } from 'zod'

const diamondItemSchema = z.object({
  carat:    z.string().min(1),
  shape:    z.string().min(1),
  type:     z.string().min(1),
  ringSize: z.string().optional(),
  design:   z.string().optional(),
  metal:    z.string().optional(),
})

const schema = z.object({
  memorialName:  z.string().min(1),
  relationship:  z.string().min(1),
  clientName:    z.string().min(1),
  contactNumber: z.string().min(1),
  email:         z.string().email(),
  mailingAddress:z.string().min(1),
  sourceType:    z.string().min(1),
  sourceOther:   z.string().optional(),
  remarks:       z.string().optional(),
  mailingPackage:z.string().min(1),
  color:         z.string().min(1),
  diamonds:      z.array(diamondItemSchema).min(1).max(8),
})

type OrderInput = z.infer<typeof schema>

function optionValues(options: SfsSpecOption[]) {
  return new Set(options.map(option => option.value))
}

async function validateSpecOptions(input: OrderInput): Promise<string | null> {
  const options = await getSfsOrderSpecOptions()
  const colors = optionValues(options.colors)
  const carats = optionValues(options.carats)
  const shapes = optionValues(options.shapes)
  const settingTypes = optionValues(options.settingTypes)
  const ringDesigns = optionValues(options.ringDesigns)
  const necklaceDesigns = optionValues(options.necklaceDesigns)
  const metals = optionValues(options.metals)

  if (!colors.has(input.color)) return 'Invalid diamond color'

  for (let index = 0; index < input.diamonds.length; index += 1) {
    const diamond = input.diamonds[index]
    const label = `Diamond #${index + 1}`
    if (!carats.has(diamond.carat)) return `${label}: invalid carat`
    if (!shapes.has(diamond.shape)) return `${label}: invalid shape`
    if (!settingTypes.has(diamond.type)) return `${label}: invalid setting type`
    if (diamond.type === 'Ring' && !diamond.ringSize?.trim()) return `${label}: ring size is required`
    if (diamond.type === 'Ring' && !ringDesigns.has(diamond.design ?? '')) return `${label}: invalid ring design`
    if (diamond.type === 'Necklace' && !necklaceDesigns.has(diamond.design ?? '')) return `${label}: invalid necklace design`
    if (diamond.type !== 'Diamond only' && !metals.has(diamond.metal ?? '')) return `${label}: invalid metal`
  }

  return null
}

// Generate next sequential sample code: SFSB000001, SFSB000002, …
async function generateSampleCode(): Promise<string> {
  const last = await prisma.sfsOrder.findFirst({
    where: { sampleCode: { startsWith: 'SFSB' } },
    orderBy: { sampleCode: 'desc' },
    select: { sampleCode: true },
  })
  const lastNum = last?.sampleCode ? parseInt(last.sampleCode.slice(4), 10) : 0
  const next = (isNaN(lastNum) ? 0 : lastNum) + 1
  return `SFSB${String(next).padStart(6, '0')}`
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const linkedUserId = session?.user.platform === 'SFS_DIAMOND' ? session.user.id : null

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }
  const specError = await validateSpecOptions(parsed.data)
  if (specError) {
    return NextResponse.json({ error: specError }, { status: 400 })
  }

  const sampleCode = await generateSampleCode()

  // Attach a unique code to each diamond: SFSB000001D01, SFSB000001D02, …
  const diamonds = parsed.data.diamonds.map((d, i) => ({
    ...d,
    code: `${sampleCode}D${String(i + 1).padStart(2, '0')}`,
  }))

  const { clientName, contactNumber, email, mailingAddress } = parsed.data

  const order = await prisma.$transaction(async tx => {
    const customer = linkedUserId
      ? await tx.sfsCustomer.upsert({
          where: { userId: linkedUserId },
          create: {
            userId: linkedUserId,
            name: clientName,
            email,
            phone: contactNumber,
            mailingAddress,
          },
          update: {
            name: clientName,
            email,
            phone: contactNumber,
            mailingAddress,
          },
        })
      : await tx.sfsCustomer.create({
          data: {
            name: clientName,
            email,
            phone: contactNumber,
            mailingAddress,
          },
        })

    const created = await tx.sfsOrder.create({
      data: {
        ...parsed.data,
        date: new Date().toISOString().slice(0, 10),
        sampleCode,
        diamonds,
        userId: linkedUserId,
        customerId: customer.id,
      },
    })

    // Save phone + address back to the user for future pre-fill
    if (linkedUserId) {
      await tx.user.update({
        where: { id: linkedUserId },
        data: { phone: contactNumber, mailingAddress },
      })
    }

    return created
  })

  return NextResponse.json({ orderId: order.id, sampleCode }, { status: 201 })
}

export async function GET() {
  const session = await auth()
  if (!session || session.user.platform !== 'SFS_DIAMOND') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orders = await prisma.sfsOrder.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(orders)
}
