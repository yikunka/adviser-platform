'use client'

import React from 'react'
import { useLocale } from 'next-intl'
import {
  LOCATION_COUNTRIES,
  kycSelectOptionStyle,
  isChineseLocale,
  localizeOption,
  localizeUi,
  countryFor,
  regionFor,
  splitLocationValue,
  splitAddressValue,
  actualCountry,
  actualRegion,
  actualCity,
  joinParts,
} from '@/lib/kyc/locationData'
import {
  KYC_TITLE_OPTIONS,
  KYC_ID_TYPE_OPTIONS,
  KYC_EMPLOYMENT_STATUS_OPTIONS,
  KYC_BUSINESS_NATURE_OPTIONS,
  KYC_BUSINESS_NATURE_FIXED,
  KYC_SOURCES_OF_WEALTH_OPTIONS,
  KYC_SOURCES_OF_WEALTH_FIXED,
  KYC_ANNUAL_INCOME_OPTIONS,
  KYC_NET_ASSET_OPTIONS,
  KYC_ASSET_ITEM_OPTIONS,
  splitCommaList,
  joinCommaList,
} from '@/lib/kyc/kycFieldOptions'
import { kycClientFieldStyle } from '@/components/kyc/kycFieldStyles'

type FieldStyle = React.CSSProperties

function mergeStyle(base: FieldStyle, override?: FieldStyle): FieldStyle {
  return override ? { ...base, ...override } : base
}

type SelectProps = {
  value?: string | null
  onChange: (value: string) => void
  disabled?: boolean
  fieldStyle?: FieldStyle
}

export function KycTitleSelect({ value, onChange, disabled, fieldStyle }: SelectProps) {
  const style = mergeStyle(kycClientFieldStyle, fieldStyle)
  return (
    <select style={style} disabled={disabled} value={value ?? ''} onChange={e => onChange(e.target.value)}>
      <option value="" style={kycSelectOptionStyle}>—</option>
      {KYC_TITLE_OPTIONS.map(opt => (
        <option key={opt} value={opt} style={kycSelectOptionStyle}>
          {opt === 'Mr.' ? 'Mr. 先生' : opt === 'Ms.' ? 'Ms. 女士' : 'Mrs. 太太'}
        </option>
      ))}
    </select>
  )
}

export function KycIdTypeSelect({ value, onChange, disabled, fieldStyle }: SelectProps) {
  const style = mergeStyle(kycClientFieldStyle, fieldStyle)
  return (
    <select style={style} disabled={disabled} value={value ?? ''} onChange={e => onChange(e.target.value)}>
      <option value="" style={kycSelectOptionStyle}>—</option>
      {KYC_ID_TYPE_OPTIONS.map(opt => (
        <option key={opt.value} value={opt.value} style={kycSelectOptionStyle}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

export function KycEmploymentStatusSelect({
  value,
  onChange,
  disabled,
  fieldStyle,
  labels,
}: SelectProps & {
  labels?: Record<string, string>
}) {
  const style = mergeStyle(kycClientFieldStyle, fieldStyle)
  const defaultLabels: Record<string, string> = {
    employed: 'Employed',
    selfEmployed: 'Self-employed',
    retired: 'Retired',
    unemployed: 'Unemployed',
  }
  const L = labels ?? defaultLabels
  return (
    <select style={style} disabled={disabled} value={value ?? ''} onChange={e => onChange(e.target.value)}>
      <option value="" style={kycSelectOptionStyle}>—</option>
      {KYC_EMPLOYMENT_STATUS_OPTIONS.map(opt => (
        <option key={opt.value} value={opt.value} style={kycSelectOptionStyle}>
          {L[opt.labelKey] ?? opt.labelKey}
        </option>
      ))}
    </select>
  )
}

export function KycCountrySelectField({ value, onChange, disabled, fieldStyle }: SelectProps) {
  const zh = isChineseLocale(useLocale())
  const style = mergeStyle(kycClientFieldStyle, fieldStyle)
  const selected = value && countryFor(value) ? value : value ? 'Other' : ''
  return (
    <div className="space-y-3">
      <select
        style={style}
        disabled={disabled}
        value={selected}
        onChange={e => onChange(e.target.value)}
      >
        <option value="" style={kycSelectOptionStyle}>—</option>
        {LOCATION_COUNTRIES.map(country => (
          <option key={country.value} value={country.value} style={kycSelectOptionStyle}>
            {localizeOption(country.value, zh)}
          </option>
        ))}
      </select>
      {selected === 'Other' ? (
        <input
          style={style}
          disabled={disabled}
          value={value && !countryFor(value) ? value : ''}
          placeholder={localizeUi('Other country / nationality', zh)}
          onChange={e => onChange(e.target.value)}
        />
      ) : null}
    </div>
  )
}

export function KycLocationSelectField({ value, onChange, disabled, fieldStyle }: SelectProps) {
  const zh = isChineseLocale(useLocale())
  const style = mergeStyle(kycClientFieldStyle, fieldStyle)
  const parts = splitLocationValue(value ?? undefined)
  const regions = countryFor(parts.country)?.regions ?? []
  const cities = regionFor(parts.country, parts.region)?.cities ?? []

  function commit(next: typeof parts) {
    onChange(joinParts([actualCountry(next), actualRegion(next), actualCity(next)]))
  }

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <select
          aria-label="Country / Region"
          style={style}
          disabled={disabled}
          value={parts.country}
          onChange={e => commit({ country: e.target.value, countryOther: '', region: '', regionOther: '', city: '', cityOther: '' })}
        >
          <option value="" style={kycSelectOptionStyle}>{localizeUi('Country / Region', zh)}</option>
          {LOCATION_COUNTRIES.map(country => (
            <option key={country.value} value={country.value} style={kycSelectOptionStyle}>
              {localizeOption(country.value, zh)}
            </option>
          ))}
        </select>
        <select
          aria-label="Province / State"
          style={style}
          disabled={disabled || regions.length === 0}
          value={parts.region}
          onChange={e => commit({ ...parts, region: e.target.value, regionOther: '', city: '', cityOther: '' })}
        >
          <option value="" style={kycSelectOptionStyle}>{localizeUi('Province / State', zh)}</option>
          {regions.map(region => (
            <option key={region.value} value={region.value} style={kycSelectOptionStyle}>
              {localizeOption(region.value, zh)}
            </option>
          ))}
        </select>
        <select
          aria-label="City"
          style={style}
          disabled={disabled || cities.length === 0}
          value={parts.city}
          onChange={e => commit({ ...parts, city: e.target.value, cityOther: '' })}
        >
          <option value="" style={kycSelectOptionStyle}>{localizeUi('City', zh)}</option>
          {cities.map(city => (
            <option key={city} value={city} style={kycSelectOptionStyle}>
              {localizeOption(city, zh)}
            </option>
          ))}
        </select>
      </div>
      {(parts.country === 'Other' || parts.region === 'Other' || parts.city === 'Other') ? (
        <div className="grid sm:grid-cols-3 gap-3">
          {parts.country === 'Other' ? (
            <input style={style} disabled={disabled} value={parts.countryOther} placeholder={localizeUi('Other country', zh)} onChange={e => commit({ ...parts, countryOther: e.target.value })} />
          ) : <div />}
          {parts.region === 'Other' ? (
            <input style={style} disabled={disabled} value={parts.regionOther} placeholder={localizeUi('Other province / state', zh)} onChange={e => commit({ ...parts, regionOther: e.target.value })} />
          ) : <div />}
          {parts.city === 'Other' ? (
            <input style={style} disabled={disabled} value={parts.cityOther} placeholder={localizeUi('Other city', zh)} onChange={e => commit({ ...parts, cityOther: e.target.value })} />
          ) : <div />}
        </div>
      ) : null}
    </div>
  )
}

export function KycAddressSelectField({ value, onChange, disabled, fieldStyle }: SelectProps) {
  const zh = isChineseLocale(useLocale())
  const style = mergeStyle(kycClientFieldStyle, fieldStyle)
  const parts = splitAddressValue(value ?? undefined)
  const regions = countryFor(parts.country)?.regions ?? []
  const cities = regionFor(parts.country, parts.region)?.cities ?? []

  function commit(next: typeof parts) {
    onChange(joinParts([actualCountry(next), actualRegion(next), actualCity(next), next.detail]))
  }

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <select
          aria-label="Country / Region"
          style={style}
          disabled={disabled}
          value={parts.country}
          onChange={e => commit({ country: e.target.value, countryOther: '', region: '', regionOther: '', city: '', cityOther: '', detail: parts.detail })}
        >
          <option value="" style={kycSelectOptionStyle}>{localizeUi('Country / Region', zh)}</option>
          {LOCATION_COUNTRIES.map(country => (
            <option key={country.value} value={country.value} style={kycSelectOptionStyle}>
              {localizeOption(country.value, zh)}
            </option>
          ))}
        </select>
        <select
          aria-label="Province / State"
          style={style}
          disabled={disabled || regions.length === 0}
          value={parts.region}
          onChange={e => commit({ ...parts, region: e.target.value, regionOther: '', city: '', cityOther: '' })}
        >
          <option value="" style={kycSelectOptionStyle}>{localizeUi('Province / State', zh)}</option>
          {regions.map(region => (
            <option key={region.value} value={region.value} style={kycSelectOptionStyle}>
              {localizeOption(region.value, zh)}
            </option>
          ))}
        </select>
        <select
          aria-label="City"
          style={style}
          disabled={disabled || cities.length === 0}
          value={parts.city}
          onChange={e => commit({ ...parts, city: e.target.value, cityOther: '' })}
        >
          <option value="" style={kycSelectOptionStyle}>{localizeUi('City', zh)}</option>
          {cities.map(city => (
            <option key={city} value={city} style={kycSelectOptionStyle}>
              {localizeOption(city, zh)}
            </option>
          ))}
        </select>
      </div>
      {(parts.country === 'Other' || parts.region === 'Other' || parts.city === 'Other') ? (
        <div className="grid sm:grid-cols-3 gap-3">
          {parts.country === 'Other' ? (
            <input style={style} disabled={disabled} value={parts.countryOther} placeholder={localizeUi('Other country', zh)} onChange={e => commit({ ...parts, countryOther: e.target.value })} />
          ) : <div />}
          {parts.region === 'Other' ? (
            <input style={style} disabled={disabled} value={parts.regionOther} placeholder={localizeUi('Other province / state', zh)} onChange={e => commit({ ...parts, regionOther: e.target.value })} />
          ) : <div />}
          {parts.city === 'Other' ? (
            <input style={style} disabled={disabled} value={parts.cityOther} placeholder={localizeUi('Other city', zh)} onChange={e => commit({ ...parts, cityOther: e.target.value })} />
          ) : <div />}
        </div>
      ) : null}
      <textarea
        rows={2}
        aria-label="Detail address"
        placeholder={localizeUi('Detail address', zh)}
        style={{ ...style, resize: 'none' }}
        disabled={disabled}
        value={parts.detail}
        onChange={e => commit({ ...parts, detail: e.target.value })}
      />
    </div>
  )
}

export function KycUsCitizenRadios({
  value,
  onChange,
  disabled,
}: {
  value: boolean | null | undefined
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex gap-6">
      {[{ val: true, label: 'Yes 是' }, { val: false, label: 'No 否' }].map(({ val, label }) => (
        <label key={String(val)} className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            disabled={disabled}
            checked={value === val}
            onChange={() => onChange(val)}
          />
          <span className="text-sm" style={{ color: 'var(--foreground)' }}>{label}</span>
        </label>
      ))}
    </div>
  )
}

export function KycBusinessNaturesField({
  value,
  onChange,
  disabled,
  fieldStyle,
}: {
  value: string | null | undefined
  onChange: (v: string) => void
  disabled?: boolean
  fieldStyle?: FieldStyle
}) {
  const style = mergeStyle(kycClientFieldStyle, fieldStyle)
  const current = splitCommaList(value)
  const fixed = new Set(KYC_BUSINESS_NATURE_FIXED)
  const custom = current.filter(v => !fixed.has(v as (typeof KYC_BUSINESS_NATURE_FIXED)[number]))
  const customText = custom.join(', ')

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {KYC_BUSINESS_NATURE_OPTIONS.map(({ value: val, label }) => {
          const checked = current.includes(val)
          return (
            <label key={val} className="flex items-start gap-2 cursor-pointer text-xs leading-snug" style={{ color: 'var(--foreground)' }}>
              <input
                type="checkbox"
                disabled={disabled}
                checked={checked}
                onChange={() => {
                  const next = checked ? current.filter(v => v !== val) : [...current, val]
                  onChange(joinCommaList(next))
                }}
                className="mt-0.5 shrink-0"
              />
              {label}
            </label>
          )
        })}
      </div>
      <input
        style={style}
        disabled={disabled}
        placeholder="Other business type..."
        defaultValue={customText}
        key={customText}
        onBlur={e => {
          const val = e.target.value.trim()
          const fromFixed = current.filter(v => fixed.has(v as (typeof KYC_BUSINESS_NATURE_FIXED)[number]))
          onChange(joinCommaList(val ? [...fromFixed, val] : fromFixed))
        }}
      />
    </div>
  )
}

export function KycSourcesOfWealthField({
  value,
  onChange,
  disabled,
  fieldStyle,
}: {
  value: string | null | undefined
  onChange: (v: string) => void
  disabled?: boolean
  fieldStyle?: FieldStyle
}) {
  const style = mergeStyle(kycClientFieldStyle, fieldStyle)
  const current = splitCommaList(value)
  const fixed = new Set(KYC_SOURCES_OF_WEALTH_FIXED)
  const custom = current.filter(v => !fixed.has(v as (typeof KYC_SOURCES_OF_WEALTH_FIXED)[number]))
  const customText = custom.join(', ')

  return (
    <div className="space-y-2">
      {KYC_SOURCES_OF_WEALTH_OPTIONS.map(({ value: val, label }) => {
        const checked = current.includes(val)
        return (
          <label key={val} className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--foreground)' }}>
            <input
              type="checkbox"
              disabled={disabled}
              checked={checked}
              onChange={() => {
                const next = checked ? current.filter(v => v !== val) : [...current, val]
                onChange(joinCommaList(next))
              }}
            />
            {label}
          </label>
        )
      })}
      <input
        style={style}
        disabled={disabled}
        placeholder="Specify other source..."
        defaultValue={customText}
        key={customText}
        onBlur={e => {
          const val = e.target.value.trim()
          const fromFixed = current.filter(v => fixed.has(v as (typeof KYC_SOURCES_OF_WEALTH_FIXED)[number]))
          onChange(joinCommaList(val ? [...fromFixed, val] : fromFixed))
        }}
      />
    </div>
  )
}

export function KycAnnualIncomeRadios({
  value,
  onChange,
  disabled,
}: SelectProps) {
  return (
    <div className="space-y-2">
      {KYC_ANNUAL_INCOME_OPTIONS.map(opt => (
        <label key={opt} className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--foreground)' }}>
          <input
            type="radio"
            disabled={disabled}
            checked={value === opt}
            onChange={() => onChange(opt)}
          />
          {opt}
        </label>
      ))}
    </div>
  )
}

export function KycNetAssetRadios({
  value,
  onChange,
  disabled,
}: SelectProps) {
  return (
    <div className="space-y-2">
      {KYC_NET_ASSET_OPTIONS.map(opt => (
        <label key={opt} className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--foreground)' }}>
          <input
            type="radio"
            disabled={disabled}
            checked={value === opt}
            onChange={() => onChange(opt)}
          />
          {opt}
        </label>
      ))}
    </div>
  )
}

export function KycAssetItemsField({
  value,
  onChange,
  disabled,
}: {
  value: string | null | undefined
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const current = splitCommaList(value)
  return (
    <div className="grid grid-cols-2 gap-2">
      {KYC_ASSET_ITEM_OPTIONS.map(({ value: val, label }) => {
        const checked = current.includes(val)
        return (
          <label key={val} className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--foreground)' }}>
            <input
              type="checkbox"
              disabled={disabled}
              checked={checked}
              onChange={() => {
                const next = checked ? current.filter(v => v !== val) : [...current, val]
                onChange(joinCommaList(next))
              }}
            />
            {label}
          </label>
        )
      })}
    </div>
  )
}
