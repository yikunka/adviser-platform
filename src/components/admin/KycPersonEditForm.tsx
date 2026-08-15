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
          A. Client Identity / 客戶身分
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="KYC Code">
            <TextInput value={values.kycCode} onChange={v => set('kycCode', v)} disabled={disabled} />
          </Field>
          <Field label="Title 稱謂">
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
          <Field label="Chinese Name 中文姓名">
            <TextInput value={values.nameZh} onChange={v => set('nameZh', v)} disabled={disabled} />
          </Field>
          <Field label="Nationality 國籍" className="sm:col-span-2">
            <KycCountrySelectField
              value={values.nationality}
              onChange={v => set('nationality', v)}
              disabled={disabled}
              fieldStyle={fieldStyle}
            />
          </Field>
          <Field label="Date of Birth 出生日期">
            <DatePickerPopover
              value={values.dateOfBirth ?? ''}
              onChange={v => set('dateOfBirth', v)}
              disabled={disabled}
              style={fieldStyle}
            />
          </Field>
          <Field label="Place of Birth 出生地">
            <KycProvinceSelectField
              value={values.placeOfBirth}
              onChange={v => set('placeOfBirth', v)}
              disabled={disabled}
              fieldStyle={fieldStyle}
            />
          </Field>
          <Field label="Residential Address 住址" className="sm:col-span-2">
            <TextArea value={values.homeAddress} onChange={v => set('homeAddress', v)} disabled={disabled} />
          </Field>
          <Field label="Correspondence Address 通訊地址" className="sm:col-span-2">
            <TextArea value={values.contactAddress} onChange={v => set('contactAddress', v)} disabled={disabled} />
          </Field>
          <Field label="Home Phone 住宅電話">
            <TextInput value={values.homePhone} onChange={v => set('homePhone', v)} disabled={disabled} />
          </Field>
          <Field label="Work Phone 辦公電話">
            <TextInput value={values.workPhone} onChange={v => set('workPhone', v)} disabled={disabled} />
          </Field>
          <Field label="Mobile 手機">
            <TextInput value={values.mobile} onChange={v => set('mobile', v)} disabled={disabled} />
          </Field>
          <Field label="Email 電郵">
            <TextInput type="email" value={values.email} onChange={v => set('email', v)} disabled={disabled} />
          </Field>
          <Field label="WeChat 微信" className="sm:col-span-2">
            <TextInput value={values.wechat} onChange={v => set('wechat', v)} disabled={disabled} />
          </Field>
          <Field label="Emergency Contact 緊急聯絡人" className="sm:col-span-2">
            <TextInput value={values.emergencyContact} onChange={v => set('emergencyContact', v)} disabled={disabled} />
          </Field>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#C9A96E' }}>
          B. Identity Document / 身分證明文件
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Document Type 證件類型">
            <KycIdTypeSelect
              value={values.idType}
              onChange={v => set('idType', v)}
              disabled={disabled}
              fieldStyle={fieldStyle}
            />
          </Field>
          <Field label="Document Number 證件號碼">
            <TextInput value={values.idNumber} onChange={v => set('idNumber', v)} disabled={disabled} />
          </Field>
          <Field label="Place of Issue 簽發地" className="sm:col-span-2">
            <KycProvinceSelectField
              value={values.placeOfIssue}
              onChange={v => set('placeOfIssue', v)}
              disabled={disabled}
              fieldStyle={fieldStyle}
            />
          </Field>
          <Field label="Expiry Date 到期日">
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
                Long-term / 長期
              </label>
            </div>
          </Field>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#C9A96E' }}>
          C. Occupation / 職業
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Employment Status 就業情況" className="sm:col-span-2">
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
              <Field label="Employer / Company 僱主/公司" className="sm:col-span-2">
                <TextInput value={values.employerName} onChange={v => set('employerName', v)} disabled={disabled} />
              </Field>
              <Field label="Company Address 公司地址" className="sm:col-span-2">
                <TextArea value={values.employerAddress} onChange={v => set('employerAddress', v)} disabled={disabled} />
              </Field>
              <Field label="Position 職位">
                <TextInput value={values.position} onChange={v => set('position', v)} disabled={disabled} />
              </Field>
              <Field label="Years in Role 任職年數">
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
              <Field label="Nature of Business 業務性質" className="sm:col-span-2">
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
          D. Financial Profile / 財務狀況
        </p>
        <div className="space-y-4">
          <Field label="Source of Wealth 財富來源">
            <KycSourcesOfWealthField
              value={values.sourcesOfWealthText}
              onChange={v => set('sourcesOfWealthText', v)}
              disabled={disabled}
              fieldStyle={fieldStyle}
            />
          </Field>
          <Field label="Source of Funds 資金來源">
            <TextArea value={values.sourceOfFunds} onChange={v => set('sourceOfFunds', v)} disabled={disabled} />
          </Field>
          <Field label="Annual Income (USD) 年收入">
            <KycAnnualIncomeRadios
              value={values.annualIncome}
              onChange={v => set('annualIncome', v)}
              disabled={disabled}
            />
          </Field>
          <Field label="Net Assets (USD) 淨資產">
            <KycNetAssetRadios
              value={values.netAssetValue}
              onChange={v => set('netAssetValue', v)}
              disabled={disabled}
            />
          </Field>
          <Field label="Main Asset Types 主要資產類別">
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
          F. PEP / 政治人物
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
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
                PEP / family member / close associate — 政治人物或其家庭成員/密切關係人
              </span>
            </label>
          </Field>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#C9A96E' }}>
          G. Declaration / 聲明
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="US Citizen or US Tax Resident 美國公民或稅務居民" className="sm:col-span-2">
            <KycUsCitizenRadios
              value={values.isUsCitizen}
              onChange={v => set('isUsCitizen', v)}
              disabled={disabled}
            />
          </Field>
          <Field label="Full Name (signature) 全名" className="sm:col-span-2">
            <TextInput value={values.signatureName} onChange={v => set('signatureName', v)} disabled={disabled} />
          </Field>
          <Field label="Date 日期">
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
              Signed / 已簽署
            </label>
          </Field>
        </div>
      </div>
    </div>
  )
}
