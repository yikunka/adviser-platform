import { Prisma, type AccountType } from '@prisma/client'
import type { prisma } from '@/lib/db/prisma'
import { DEFAULT_MAPPING_CODES } from '@/lib/financial/account-mappings'

export type PartyAccountSide = 'ar' | 'ap'

type PartyAccountClient = Pick<typeof prisma, 'accountMapping' | 'finAccount'>

export class PartyAccountError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PartyAccountError'
  }
}

const PARTY_ACCOUNT_CONFIG: Record<PartyAccountSide, {
  mappingKey: 'AR_CONTROL' | 'AP_CONTROL'
  suffix: string
  fallbackType: AccountType
}> = {
  ar: {
    mappingKey: 'AR_CONTROL',
    suffix: '应收-AR',
    fallbackType: 'ASSET',
  },
  ap: {
    mappingKey: 'AP_CONTROL',
    suffix: '应付-AP',
    fallbackType: 'LIABILITY',
  },
}

export function partyAccountName(partyName: string, side: PartyAccountSide) {
  return `${partyName.trim()} ${PARTY_ACCOUNT_CONFIG[side].suffix}`
}

export function nextPartyAccountCode(parentCode: string, existingCodes: Iterable<string>) {
  const used = new Set([...existingCodes].map(code => code.toLowerCase()))
  const base = parentCode.trim()

  for (let index = 1; index <= 999; index += 1) {
    const candidate = `${base}.${String(index).padStart(3, '0')}`
    if (!used.has(candidate.toLowerCase())) return candidate
  }

  for (let index = 1000; index <= 9999; index += 1) {
    const candidate = `${base}.${index}`
    if (!used.has(candidate.toLowerCase())) return candidate
  }

  return `${base}.${Date.now()}`
}

export async function validatePartyAccount(
  client: PartyAccountClient,
  companyId: string,
  accountId: string | null | undefined,
) {
  if (!accountId) return null

  return client.finAccount.findFirst({
    where: { id: accountId, companyId },
    select: { id: true },
  })
}

async function resolveControlAccount(
  client: PartyAccountClient,
  companyId: string,
  side: PartyAccountSide,
) {
  const config = PARTY_ACCOUNT_CONFIG[side]
  const mapping = await client.accountMapping.findUnique({
    where: { companyId_key: { companyId, key: config.mappingKey } },
    select: { accountId: true },
  })

  const accountId = mapping?.accountId
  if (accountId) {
    const mappedAccount = await client.finAccount.findFirst({
      where: { id: accountId, companyId },
      select: { id: true, code: true, name: true, type: true, parentId: true, level: true },
    })
    if (mappedAccount) return mappedAccount
  }

  return client.finAccount.findFirst({
    where: { companyId, code: DEFAULT_MAPPING_CODES[config.mappingKey] },
    select: { id: true, code: true, name: true, type: true, parentId: true, level: true },
  })
}

async function resolveAutoParent(
  client: PartyAccountClient,
  companyId: string,
  side: PartyAccountSide,
) {
  const control = await resolveControlAccount(client, companyId, side)
  if (!control) return null
  if (control.level < 3) return control
  if (!control.parentId) return null

  return client.finAccount.findFirst({
    where: { id: control.parentId, companyId },
    select: { id: true, code: true, name: true, type: true, parentId: true, level: true },
  })
}

export async function ensurePartyAccount(
  tx: Prisma.TransactionClient,
  args: {
    companyId: string
    partyName: string
    side: PartyAccountSide
    selectedAccountId?: string | null
  },
) {
  if (args.selectedAccountId) {
    const selected = await validatePartyAccount(tx, args.companyId, args.selectedAccountId)
    if (!selected) {
      throw new PartyAccountError(args.side === 'ar' ? '关联应收科目不存在或不属于该公司。' : '关联应付科目不存在或不属于该公司。')
    }
    return selected.id
  }

  const parent = await resolveAutoParent(tx, args.companyId, args.side)
  const config = PARTY_ACCOUNT_CONFIG[args.side]
  const allAccounts = await tx.finAccount.findMany({
    where: { companyId: args.companyId },
    select: { code: true },
  })
  const siblingSort = parent
    ? await tx.finAccount.aggregate({
        where: { companyId: args.companyId, parentId: parent.id },
        _max: { sortOrder: true },
      })
    : await tx.finAccount.aggregate({
        where: { companyId: args.companyId, parentId: null },
        _max: { sortOrder: true },
      })

  const created = await tx.finAccount.create({
    data: {
      companyId: args.companyId,
      code: nextPartyAccountCode(parent?.code ?? DEFAULT_MAPPING_CODES[config.mappingKey], allAccounts.map(account => account.code)),
      name: partyAccountName(args.partyName, args.side),
      type: parent?.type ?? config.fallbackType,
      parentId: parent?.id ?? null,
      level: parent ? parent.level + 1 : 1,
      sortOrder: (siblingSort._max.sortOrder ?? 0) + 1,
      isSystem: false,
      notes: args.side === 'ar' ? '往来单位客户应收科目自动创建' : '往来单位供应商应付科目自动创建',
      yearToDateAmount: new Prisma.Decimal(0),
      yearToDateDebit: new Prisma.Decimal(0),
      yearToDateCredit: new Prisma.Decimal(0),
    },
    select: { id: true },
  })

  return created.id
}
