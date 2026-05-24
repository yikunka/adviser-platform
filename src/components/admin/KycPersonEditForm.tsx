'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import type { KycPersonInput } from '@/lib/kyc/personZod'
import { DatePickerPopover } from '@/components/ui/date-picker-popover'
import { kycAdminFieldStyle } from '@/components/kyc/kycFieldStyles'
import {
  KycTitleSelect,
  KycIdTypeSelect,
  KycCountrySelectField,
  KycProvinceSelectField,
  KycEmploymentStatusSelect,
  KycUsCitizenRadios,
  KycBusinessNaturesField,
  KycSourcesOfWealthField,
  KycAnnualIncomeRadios,
  KycNetAssetRadios,
  KycAssetItemsField,
} from '@/components/kyc/KycFormFields'

const fieldStyle = kycAdminFieldStyle
const inputClass = 'w-full rounded-md px-3 py-2 text-sm'

function Field({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function TextInput({
  value,
  onChange,
  type = 'text',
  disabled,
}: {
  value: string | null | undefined
  onChange: (v: string) => void
  type?: string
  disabled?: boolean
}) {
  return (
    <input
      type={type}
      className={inputClass}
      style={fieldStyle}
      value={value ?? ''}
      disabled={disabled}
      onChange={e => onChange(e.target.value)}
    />
  )
}

function TextArea({
  value,
  onChange,
  disabled,
}: {
  value: string | null | undefined
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <textarea
      className={inputClass}
      style={{ ...fieldStyle, resize: 'vertical', minHeight: '5rem' }}
      value={value ?? ''}
      disabled={disabled}
      onChange={e => onChange(e.target.value)}
    />
  )
}

type Props = {
  values: KycPersonInput
  onChange: (values: KycPersonInput) => void
  disabled?: boolean
}

export function KycPersonEditForm({ values, onChange, disabled }: Props) {
  const t = useTranslations('kyc')

  function set<K extends keyof KycPersonInput>(key: K, val: KycPersonInput[K]) {
    onChange({ ...values, [key]: val })
  }

  const showEmploymentDetails =
    values.employmentStatus === 'EMPLOYED' || values.employmentStatus === 'SELF_EMPLOYED'

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#C9A96E' }}>
          Identity
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="KYC Code">
            <TextInput value={values.kycCode} onChange={v => set('kycCode', v)} disabled={disabled} />
          </Field>
          <Field label="Title">
            <KycTitleSelect
              value={values.titlePrefix}
              onChange={v => set('titlePrefix', v)}
              disabled={disabled}
              fieldStyle={fieldStyle}
            />
          </Field>
          <Field label="First Name">
            <TextInput value={values.firstName} onChange={v => set('firstName', v)} disabled={disabled} />
          </Field>
          <Field label="Last Name">
            <TextInput value={values.lastName} onChange={v => set('lastName', v)} disabled={disabled} />
          </Field>
          <Field label="Other Name">
            <TextInput value={values.otherName} onChange={v => set('otherName', v)} disabled={disabled} />
          </Field>
          <Field label="Chinese Name">
            <TextInput value={values.nameZh} onChange={v => set('nameZh', v)} disabled={disabled} />
          </Field>
          <Field label="ID Type">
            <KycIdTypeSelect
              value={values.idType}
              onChange={v => set('idType', v)}
              disabled={disabled}
              fieldStyle={fieldStyle}
            />
          </Field>
          <Field label="ID Number">
            <TextInput value={values.idNumber} onChange={v => set('idNumber', v)} disabled={disabled} />
          </Field>
          <Field label="Place of Issue" className="sm:col-span-2">
            <KycProvinceSelectField
              value={values.placeOfIssue}
              onChange={v => set('placeOfIssue', v)}
              disabled={disabled}
              fieldStyle={fieldStyle}
            />
          </Field>
          <Field label="Place of Birth" className="sm:col-span-2">
            <KycProvinceSelectField
              value={values.placeOfBirth}
              onChange={v => set('placeOfBirth', v)}
              disabled={disabled}
              fieldStyle={fieldStyle}
            />
          </Field>
          <Field label="ID Expiry">
            <div className="space-y-2">
              <DatePickerPopover
                value={values.idExpiry ?? ''}
                onChange={v => set('idExpiry', v)}
                disabled={disabled || Boolean(values.idExpiryPermanent)}
                style={fieldStyle}
              />
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--foreground)' }}>
                <input
                  type="checkbox"
                  checked={values.idExpiryPermanent ?? false}
                  onChange={e => onChange({ ...values, idExpiryPermanent: e.target.checked, idExpiry: e.target.checked ? '' : values.idExpiry })}
                  disabled={disabled}
                />
                Long-term
              </label>
            </div>
          </Field>
          <Field label="Date of Birth">
            <DatePickerPopover
              value={values.dateOfBirth ?? ''}
              onChange={v => set('dateOfBirth', v)}
              disabled={disabled}
              style={fieldStyle}
            />
          </Field>
          <Field label="Nationality" className="sm:col-span-2">
            <KycCountrySelectField
              value={values.nationality}
              onChange={v => set('nationality', v)}
              disabled={disabled}
              fieldStyle={fieldStyle}
            />
          </Field>
          <Field label="US Citizen" className="sm:col-span-2">
            <KycUsCitizenRadios
              value={values.isUsCitizen}
              onChange={v => set('isUsCitizen', v)}
              disabled={disabled}
            />
          </Field>
          <Field label="PEP" className="sm:col-span-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                disabled={disabled}
                checked={values.isPep ?? false}
                onChange={e => set('isPep', e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-sm" style={{ color: 'var(--foreground)' }}>
                Politically exposed person
              </span>
            </label>
          </Field>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#C9A96E' }}>
          Contact
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Email">
            <TextInput type="email" value={values.email} onChange={v => set('email', v)} disabled={disabled} />
          </Field>
          <Field label="Mobile">
            <TextInput value={values.mobile} onChange={v => set('mobile', v)} disabled={disabled} />
          </Field>
          <Field label="Home Phone">
            <TextInput value={values.homePhone} onChange={v => set('homePhone', v)} disabled={disabled} />
          </Field>
          <Field label="Work Phone">
            <TextInput value={values.workPhone} onChange={v => set('workPhone', v)} disabled={disabled} />
          </Field>
          <Field label="WeChat" className="sm:col-span-2">
            <TextInput value={values.wechat} onChange={v => set('wechat', v)} disabled={disabled} />
          </Field>
          <Field label="Contact Address" className="sm:col-span-2">
            <TextArea value={values.contactAddress} onChange={v => set('contactAddress', v)} disabled={disabled} />
          </Field>
          <Field label="Emergency Contact" className="sm:col-span-2">
            <TextInput value={values.emergencyContact} onChange={v => set('emergencyContact', v)} disabled={disabled} />
          </Field>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#C9A96E' }}>
          Employment
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Status" className="sm:col-span-2">
            <KycEmploymentStatusSelect
              value={values.employmentStatus ?? ''}
              onChange={v => set('employmentStatus', v as KycPersonInput['employmentStatus'])}
              disabled={disabled}
              fieldStyle={fieldStyle}
              labels={{
                employed: t('employment.employed'),
                selfEmployed: t('employment.selfEmployed'),
                retired: t('employment.retired'),
                unemployed: t('employment.unemployed'),
              }}
            />
          </Field>
          {showEmploymentDetails ? (
            <>
              <Field label="Employer" className="sm:col-span-2">
                <TextInput value={values.employerName} onChange={v => set('employerName', v)} disabled={disabled} />
              </Field>
              <Field label="Employer Address" className="sm:col-span-2">
                <TextArea value={values.employerAddress} onChange={v => set('employerAddress', v)} disabled={disabled} />
              </Field>
              <Field label="Position">
                <TextInput value={values.position} onChange={v => set('position', v)} disabled={disabled} />
              </Field>
              <Field label="Working Years">
                <input
                  type="number"
                  min={0}
                  max={80}
                  className={inputClass}
                  style={fieldStyle}
                  disabled={disabled}
                  value={values.workingYears ?? ''}
                  onChange={e => {
                    const n = e.target.value === '' ? undefined : Number(e.target.value)
                    set('workingYears', Number.isNaN(n) ? undefined : n)
                  }}
                />
              </Field>
              <Field label="Business Natures" className="sm:col-span-2">
                <KycBusinessNaturesField
                  value={values.businessNaturesText}
                  onChange={v => set('businessNaturesText', v)}
                  disabled={disabled}
                  fieldStyle={fieldStyle}
                />
              </Field>
            </>
          ) : null}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#C9A96E' }}>
          Financial
        </p>
        <div className="space-y-4">
          <Field label="Sources of Wealth">
            <KycSourcesOfWealthField
              value={values.sourcesOfWealthText}
              onChange={v => set('sourcesOfWealthText', v)}
              disabled={disabled}
              fieldStyle={fieldStyle}
            />
          </Field>
          <Field label="Annual Income (USD)">
            <KycAnnualIncomeRadios
              value={values.annualIncome}
              onChange={v => set('annualIncome', v)}
              disabled={disabled}
            />
          </Field>
          <Field label="Net Asset Value (USD)">
            <KycNetAssetRadios
              value={values.netAssetValue}
              onChange={v => set('netAssetValue', v)}
              disabled={disabled}
            />
          </Field>
          <Field label="Asset Items">
            <KycAssetItemsField
              value={values.assetItemsText}
              onChange={v => set('assetItemsText', v)}
              disabled={disabled}
            />
          </Field>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#C9A96E' }}>
          Declaration
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Signature Name" className="sm:col-span-2">
            <TextInput value={values.signatureName} onChange={v => set('signatureName', v)} disabled={disabled} />
          </Field>
          <Field label="Declaration Date">
            <DatePickerPopover
              value={values.declarationDate ?? ''}
              onChange={v => set('declarationDate', v)}
              disabled={disabled}
              style={fieldStyle}
            />
          </Field>
          <Field label="Declaration Signed">
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--foreground)' }}>
              <input
                type="checkbox"
                checked={values.declarationSigned ?? false}
                onChange={e => set('declarationSigned', e.target.checked)}
                disabled={disabled}
              />
              Signed
            </label>
          </Field>
        </div>
      </div>
    </div>
  )
}
