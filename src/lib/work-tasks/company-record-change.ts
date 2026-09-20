import {
  crBrn,
  crCompanyName,
  crPdf,
  isoSlashDate,
  renderCrPdf,
  type CrPresentor,
  type CrSignatoryCapacity,
} from '@/lib/work-tasks/cr-pdf'
import { REGISTER_ITEMS, type RegisterItemKey } from '@/lib/work-tasks/register-items'

export { REGISTER_ITEMS, type RegisterItemKey }

export type RegisteredOfficeInput = CrPresentor & {
  companyNameEn: string
  companyNameZh: string
  companyNo: string
  brn: string
  flat: string
  building: string
  street: string
  district: string
  effectiveDate: string
  newEmail: string
  newPhone: string
  signatoryName: string
  signatoryCapacity: 'DIRECTOR' | 'COMPANY_SECRETARY'
  signatoryDate: string
}

export type RegisterLocationInput = CrPresentor & {
  companyNameEn: string
  companyNameZh: string
  companyNo: string
  brn: string
  registers: RegisterItemKey[]
  location: 'OTHER' | 'REGISTERED_OFFICE'
  flat: string
  building: string
  street: string
  district: string
  effectiveDate: string
  remarks: string
  signatoryName: string
  signatoryCapacity: CrSignatoryCapacity
  signatoryDate: string
}

export type AccountingReferenceChange = 'SHORTEN' | 'EXTEND'
export type AccountingExtensionReason = 'NONE_IN_FIVE_YEARS' | 'HOLDING_COMPANY' | 'MEMBERS_RESOLUTION'

export type AccountingReferenceInput = CrPresentor & {
  companyNameEn: string
  companyNameZh: string
  companyNo: string
  brn: string
  currentPeriodEnd: string
  change: AccountingReferenceChange
  newPeriodEnd: string
  extensionReason: AccountingExtensionReason | ''
  resolutionDate: string
  memberNames: string[]
  signatoryName: string
  signatoryCapacity: 'DIRECTOR' | 'COMPANY_SECRETARY'
  signatoryDate: string
}

function presentorName(input: CrPresentor): string {
  return input.presentorNameEn.trim() || input.presentorNameZh.trim()
}

function safeCompany(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '-').trim() || 'company'
}

export async function renderRegisteredOffice(input: RegisteredOfficeInput): Promise<{ templateKey: string; fileName: string; buffer: Buffer }> {
  const brn = crBrn(input.brn || input.companyNo)
  const buffer = await renderCrPdf('NR1_Change_Registered_Office_Address.pdf', form => {
    crPdf.setText(form, 'fill_1_P.1', brn)
    crPdf.setText(form, 'fill_2_P.1', crCompanyName(input.companyNameEn, input.companyNameZh))
    crPdf.setText(form, 'fill_3_P.1', input.flat)
    crPdf.setText(form, 'fill_4_P.1', input.building)
    crPdf.setText(form, 'fill_5_P.1', input.street)
    crPdf.setText(form, 'fill_6_P.1', input.district)
    crPdf.setDate(form, 'fill_7_P.1', 'fill_8_P.1', 'fill_9_P.1', input.effectiveDate)
    if (input.newEmail.trim()) {
      crPdf.setText(form, 'fill_10_P.1', input.newEmail)
      crPdf.setDate(form, 'fill_11_P.1', 'fill_12_P.1', 'fill_13_P.1', input.effectiveDate)
    }
    if (input.newPhone.trim()) {
      crPdf.setText(form, 'fill_14_P.1', input.newPhone)
      crPdf.setDate(form, 'fill_15_P.1', 'fill_16_P.1', 'fill_17_P.1', input.effectiveDate)
    }
    crPdf.setText(form, 'fill_18_P.1', input.signatoryName)
    crPdf.strikeDropdown(form, input.signatoryCapacity === 'DIRECTOR' ? 'Dropdown2_P.1' : 'Dropdown1_P.1')
    crPdf.setText(form, 'fill_19_P.1', isoSlashDate(input.signatoryDate))
    crPdf.setText(form, 'fill_20_P.1', presentorName(input))
    crPdf.setText(form, 'fill_21_P.1', input.presentorAddress)
    crPdf.setText(form, 'fill_22_P.1', input.presentorTel)
    crPdf.setText(form, 'fill_23_P.1', input.presentorFax)
    crPdf.setText(form, 'fill_24_P.1', input.presentorEmail)
    crPdf.setText(form, 'fill_25_P.1', input.presentorReference)
  })
  return {
    templateKey: 'nr1',
    fileName: `NR1-注册办事处地址 - ${safeCompany(input.companyNameEn)}.pdf`.slice(0, 180),
    buffer,
  }
}

const NR2_CAPACITY_DROPDOWN: Record<CrSignatoryCapacity, string> = {
  DIRECTOR: 'Dropdown1_P.2',
  COMPANY_SECRETARY: 'Dropdown2_P.2',
  MANAGER: 'Dropdown3_P.2',
  AUTHORIZED_REPRESENTATIVE: 'Dropdown4_P.2',
}

export async function renderRegisterLocation(input: RegisterLocationInput): Promise<{ templateKey: string; fileName: string; buffer: Buffer }> {
  const brn = crBrn(input.brn || input.companyNo)
  const selected = new Set(input.registers)
  const buffer = await renderCrPdf('NR2_Location_of_Registers.pdf', form => {
    crPdf.setText(form, 'fill_1_P.1', brn)
    crPdf.setText(form, 'fill_1_P.2', brn)
    crPdf.setText(form, 'fill_1_P.3', brn)
    crPdf.setText(form, 'fill_2_P.1', crCompanyName(input.companyNameEn, input.companyNameZh))
    for (const item of REGISTER_ITEMS) {
      if (selected.has(item.key)) crPdf.checkBox(form, item.field)
    }
    if (input.location === 'OTHER') {
      crPdf.checkBox(form, 'cb_1_P.2')
      crPdf.setText(form, 'fill_2_P.2', input.flat)
      crPdf.setText(form, 'fill_3_P.2', input.building)
      crPdf.setText(form, 'fill_4_P.2', input.street)
      crPdf.setText(form, 'fill_5_P.2', input.district)
    } else {
      crPdf.checkBox(form, 'cb_2_P.2')
    }
    crPdf.setDate(form, 'fill_6_P.2', 'fill_7_P.2', 'fill_8_P.2', input.effectiveDate)
    crPdf.setText(form, 'fill_9_P.2', input.remarks)
    crPdf.setText(form, 'fill_11_P.2', input.signatoryName)
    for (const [capacity, field] of Object.entries(NR2_CAPACITY_DROPDOWN)) {
      if (capacity !== input.signatoryCapacity) crPdf.strikeDropdown(form, field)
    }
    crPdf.setText(form, 'fill_12_P.2', isoSlashDate(input.signatoryDate))
    crPdf.setText(form, 'fill_3_P.1', presentorName(input))
    crPdf.setText(form, 'fill_4_P.1', input.presentorAddress)
    crPdf.setText(form, 'fill_5_P.1', input.presentorTel)
    crPdf.setText(form, 'fill_6_P.1', input.presentorFax)
    crPdf.setText(form, 'fill_7_P.1', input.presentorEmail)
    crPdf.setText(form, 'fill_8_P.1', input.presentorReference)
  })
  return {
    templateKey: 'nr2',
    fileName: `NR2-登记册备存地点 - ${safeCompany(input.companyNameEn)}.pdf`.slice(0, 180),
    buffer,
  }
}

const EXTENSION_CHECKBOX: Record<Exclude<AccountingExtensionReason, ''>, string> = {
  NONE_IN_FIVE_YEARS: 'cb_1_P.2',
  HOLDING_COMPANY: 'cb_2_P.2',
  MEMBERS_RESOLUTION: 'cb_3_P.2',
}

export async function renderAccountingReference(input: AccountingReferenceInput): Promise<{ templateKey: string; fileName: string; buffer: Buffer }> {
  const brn = crBrn(input.brn || input.companyNo)
  const buffer = await renderCrPdf('NAC4_Alteration_Accounting_Reference_Date.pdf', form => {
    crPdf.setText(form, 'fill_1_P.1', brn)
    crPdf.setText(form, 'fill_1_P.2', brn)
    crPdf.setText(form, 'fill_2_P.1', crCompanyName(input.companyNameEn, input.companyNameZh))
    crPdf.setDate(form, 'fill_3_P.1', 'fill_4_P.1', 'fill_5_P.1', input.currentPeriodEnd)
    if (input.change === 'SHORTEN') {
      crPdf.checkBox(form, 'cb_1_P.1')
      crPdf.setDate(form, 'fill_6_P.1', 'fill_7_P.1', 'fill_8_P.1', input.newPeriodEnd)
    } else {
      crPdf.checkBox(form, 'cb_2_P.1')
      crPdf.setDate(form, 'fill_9_P.1', 'fill_10_P.1', 'fill_11_P.1', input.newPeriodEnd)
      if (input.extensionReason) crPdf.checkBox(form, EXTENSION_CHECKBOX[input.extensionReason])
    }
    crPdf.setDate(form, 'fill_2_P.2', 'fill_3_P.2', 'fill_4_P.2', input.resolutionDate)
    crPdf.setText(form, 'fill_5_P.2', input.signatoryName)
    crPdf.strikeDropdown(form, input.signatoryCapacity === 'DIRECTOR' ? 'Dropdown2_P.2' : 'Dropdown1_P.2')
    crPdf.setText(form, 'fill_6_P.2', isoSlashDate(input.signatoryDate))
    crPdf.setText(form, 'fill_12_P.1', presentorName(input))
    crPdf.setText(form, 'fill_13_P.1', input.presentorAddress)
    crPdf.setText(form, 'fill_14_P.1', input.presentorTel)
    crPdf.setText(form, 'fill_15_P.1', input.presentorFax)
    crPdf.setText(form, 'fill_16_P.1', input.presentorEmail)
    crPdf.setText(form, 'fill_17_P.1', input.presentorReference)
  })
  return {
    templateKey: 'nac4',
    fileName: `NAC4-更改会计参照日 - ${safeCompany(input.companyNameEn)}.pdf`.slice(0, 180),
    buffer,
  }
}
