'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useDropzone } from 'react-dropzone'
import {
  User, Briefcase, BarChart2, FileCheck, CheckCircle2, XCircle, Clock, Upload, Loader2, ChevronRight,
  Plus, Trash2, Download, Users,
} from 'lucide-react'
import type { KeyPerson } from '@prisma/client'
import { kycPersonZod, type KycPersonInput, keyPersonToFormValues } from '@/lib/kyc/personZod'
import { DatePickerPopover } from '@/components/ui/date-picker-popover'

const formZod = z.object({ persons: z.array(kycPersonZod).min(1) })
type FormValues = z.infer<typeof formZod> & { persons: (KycPersonInput & { kycStatus?: string })[] }

function emptyPerson(): KycPersonInput & { kycStatus?: string } {
  return {
    kycCode: '',
    nameEn: '',
    firstName: '',
    lastName: '',
    otherName: '',
    nameZh: '',
    titlePrefix: '',
    idType: '',
    idNumber: '',
    placeOfIssue: '',
    placeOfBirth: '',
    idExpiry: '',
    dateOfBirth: '',
    nationality: '',
    homeAddress: '',
    contactAddress: '',
    homePhone: '',
    workPhone: '',
    mobile: '',
    wechat: '',
    email: '',
    isUsCitizen: false,
    isPep: false,
    emergencyContact: '',
    employmentStatus: '',
    employerName: '',
    employerAddress: '',
    businessNaturesText: '',
    position: '',
    workingYears: undefined,
    sourceOfFunds: '',
    sourcesOfWealthText: '',
    annualIncome: '',
    netAssetValue: '',
    assetItemsText: '',
    declarationSigned: false,
    signatureName: '',
    declarationDate: '',
    kycStatus: 'DRAFT',
  }
}

const KYC_STATUS: Record<string, { bg: string; text: string; icon: React.ElementType; label: string }> = {
  DRAFT:        { bg: 'rgba(120,113,108,0.15)', text: '#9A8060', icon: Clock,        label: 'Draft' },
  SUBMITTED:    { bg: 'rgba(201,169,110,0.15)', text: '#C9A96E', icon: Clock,        label: 'Submitted' },
  PENDING_INFO: { bg: 'rgba(245,158,11,0.12)',  text: '#f59e0b', icon: Clock,        label: 'Pending Info' },
  APPROVED:     { bg: 'rgba(16,185,129,0.12)',  text: '#10b981', icon: CheckCircle2, label: 'Approved' },
  REJECTED:     { bg: 'rgba(239,68,68,0.12)',   text: '#ef4444', icon: XCircle,      label: 'Rejected' },
}

const STEPS = [
  { key: 'sectionA', icon: User },
  { key: 'sectionB', icon: Briefcase },
  { key: 'sectionC', icon: BarChart2 },
  { key: 'sectionD', icon: FileCheck },
] as const

const fieldStyle: React.CSSProperties = {
  width: '100%',
  background: '#0A0A0A',
  border: '1px solid #2A2418',
  color: '#F0EAD8',
  borderRadius: '0.375rem',
  padding: '0.5rem 0.75rem',
  fontSize: '0.875rem',
  outline: 'none',
  transition: 'border-color 150ms',
}
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: '#7A7060',
  marginBottom: '0.375rem',
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
      {error && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.25rem' }}>{error}</p>}
    </div>
  )
}

function DatePickerField(props: React.ComponentProps<typeof DatePickerPopover>) {
  return <DatePickerPopover {...props} style={{ ...fieldStyle, ...props.style }} />
}

type RegionOption = { value: string; cities: string[] }
type CountryOption = { value: string; regions: RegionOption[] }

const LOCATION_COUNTRIES: CountryOption[] = [
  {
    value: 'Mainland China',
    regions: [
      { value: 'Anhui', cities: ['Hefei', 'Wuhu', 'Bengbu', 'Fuyang', 'Other'] },
      { value: 'Beijing', cities: ['Beijing', 'Other'] },
      { value: 'Chongqing', cities: ['Chongqing', 'Other'] },
      { value: 'Fujian', cities: ['Fuzhou', 'Xiamen', 'Quanzhou', 'Other'] },
      { value: 'Gansu', cities: ['Lanzhou', 'Tianshui', 'Other'] },
      { value: 'Guangdong', cities: ['Guangzhou', 'Shenzhen', 'Dongguan', 'Foshan', 'Zhuhai', 'Huizhou', 'Zhongshan', 'Jiangmen', 'Shantou', 'Other'] },
      { value: 'Guangxi', cities: ['Nanning', 'Guilin', 'Liuzhou', 'Other'] },
      { value: 'Guizhou', cities: ['Guiyang', 'Zunyi', 'Other'] },
      { value: 'Hainan', cities: ['Haikou', 'Sanya', 'Other'] },
      { value: 'Hebei', cities: ['Shijiazhuang', 'Tangshan', 'Baoding', 'Other'] },
      { value: 'Heilongjiang', cities: ['Harbin', 'Qiqihar', 'Other'] },
      { value: 'Henan', cities: ['Zhengzhou', 'Luoyang', 'Kaifeng', 'Other'] },
      { value: 'Hubei', cities: ['Wuhan', 'Yichang', 'Xiangyang', 'Other'] },
      { value: 'Hunan', cities: ['Changsha', 'Zhuzhou', 'Xiangtan', 'Other'] },
      { value: 'Inner Mongolia', cities: ['Hohhot', 'Baotou', 'Other'] },
      { value: 'Jiangsu', cities: ['Nanjing', 'Suzhou', 'Wuxi', 'Changzhou', 'Nantong', 'Other'] },
      { value: 'Jiangxi', cities: ['Nanchang', 'Ganzhou', 'Jiujiang', 'Other'] },
      { value: 'Jilin', cities: ['Changchun', 'Jilin', 'Other'] },
      { value: 'Liaoning', cities: ['Shenyang', 'Dalian', 'Anshan', 'Other'] },
      { value: 'Ningxia', cities: ['Yinchuan', 'Other'] },
      { value: 'Qinghai', cities: ['Xining', 'Other'] },
      { value: 'Shaanxi', cities: ['Xi’an', 'Xianyang', 'Baoji', 'Other'] },
      { value: 'Shandong', cities: ['Jinan', 'Qingdao', 'Yantai', 'Weifang', 'Other'] },
      { value: 'Shanghai', cities: ['Shanghai', 'Other'] },
      { value: 'Shanxi', cities: ['Taiyuan', 'Datong', 'Other'] },
      { value: 'Sichuan', cities: ['Chengdu', 'Mianyang', 'Other'] },
      { value: 'Tianjin', cities: ['Tianjin', 'Other'] },
      { value: 'Tibet', cities: ['Lhasa', 'Other'] },
      { value: 'Xinjiang', cities: ['Urumqi', 'Kashgar', 'Other'] },
      { value: 'Yunnan', cities: ['Kunming', 'Dali', 'Lijiang', 'Other'] },
      { value: 'Zhejiang', cities: ['Hangzhou', 'Ningbo', 'Wenzhou', 'Jinhua', 'Other'] },
      { value: 'Other', cities: ['Other'] },
    ],
  },
  {
    value: 'Hong Kong',
    regions: [
      { value: 'Hong Kong Island', cities: ['Central and Western', 'Wan Chai', 'Eastern', 'Southern', 'Other'] },
      { value: 'Kowloon', cities: ['Yau Tsim Mong', 'Sham Shui Po', 'Kowloon City', 'Wong Tai Sin', 'Kwun Tong', 'Other'] },
      { value: 'New Territories', cities: ['Tsuen Wan', 'Tuen Mun', 'Yuen Long', 'North', 'Tai Po', 'Sha Tin', 'Sai Kung', 'Kwai Tsing', 'Other'] },
      { value: 'Outlying Islands', cities: ['Islands', 'Other'] },
      { value: 'Other', cities: ['Other'] },
    ],
  },
  { value: 'Macau', regions: [{ value: 'Macau Peninsula / Islands', cities: ['Nossa Senhora de Fatima', 'Santo Antonio', 'Sao Lazaro', 'Sao Lourenco', 'Se', 'Taipa', 'Coloane', 'Cotai', 'Other'] }, { value: 'Other', cities: ['Other'] }] },
  { value: 'Taiwan', regions: [
    { value: 'Taipei', cities: ['Taipei', 'Other'] },
    { value: 'New Taipei', cities: ['New Taipei', 'Other'] },
    { value: 'Taoyuan', cities: ['Taoyuan', 'Other'] },
    { value: 'Taichung', cities: ['Taichung', 'Other'] },
    { value: 'Tainan', cities: ['Tainan', 'Other'] },
    { value: 'Kaohsiung', cities: ['Kaohsiung', 'Other'] },
    { value: 'Hsinchu', cities: ['Hsinchu', 'Other'] },
    { value: 'Keelung', cities: ['Keelung', 'Other'] },
    { value: 'Other', cities: ['Other'] },
  ] },
  { value: 'Singapore', regions: [{ value: 'Singapore', cities: ['Singapore'] }] },
  { value: 'Malaysia', regions: [{ value: 'Malaysia', cities: ['Kuala Lumpur', 'Johor Bahru', 'Penang', 'Other'] }] },
  { value: 'United Kingdom', regions: [{ value: 'United Kingdom', cities: ['London', 'Manchester', 'Birmingham', 'Other'] }] },
  { value: 'United States', regions: [{ value: 'United States', cities: ['New York', 'Los Angeles', 'San Francisco', 'Other'] }] },
  { value: 'Canada', regions: [{ value: 'Canada', cities: ['Toronto', 'Vancouver', 'Montreal', 'Other'] }] },
  { value: 'Australia', regions: [{ value: 'Australia', cities: ['Sydney', 'Melbourne', 'Brisbane', 'Other'] }] },
  { value: 'Afghanistan', regions: [{ value: 'Afghanistan', cities: ['Kabul', 'Other'] }] },
  { value: 'Argentina', regions: [{ value: 'Argentina', cities: ['Buenos Aires', 'Cordoba', 'Other'] }] },
  { value: 'Austria', regions: [{ value: 'Austria', cities: ['Vienna', 'Other'] }] },
  { value: 'Bangladesh', regions: [{ value: 'Bangladesh', cities: ['Dhaka', 'Chittagong', 'Other'] }] },
  { value: 'Belgium', regions: [{ value: 'Belgium', cities: ['Brussels', 'Other'] }] },
  { value: 'Brazil', regions: [{ value: 'Brazil', cities: ['Sao Paulo', 'Rio de Janeiro', 'Brasilia', 'Other'] }] },
  { value: 'Cambodia', regions: [{ value: 'Cambodia', cities: ['Phnom Penh', 'Siem Reap', 'Other'] }] },
  { value: 'Chile', regions: [{ value: 'Chile', cities: ['Santiago', 'Other'] }] },
  { value: 'Denmark', regions: [{ value: 'Denmark', cities: ['Copenhagen', 'Other'] }] },
  { value: 'Egypt', regions: [{ value: 'Egypt', cities: ['Cairo', 'Alexandria', 'Other'] }] },
  { value: 'Finland', regions: [{ value: 'Finland', cities: ['Helsinki', 'Other'] }] },
  { value: 'France', regions: [{ value: 'France', cities: ['Paris', 'Lyon', 'Marseille', 'Other'] }] },
  { value: 'Germany', regions: [{ value: 'Germany', cities: ['Berlin', 'Frankfurt', 'Munich', 'Other'] }] },
  { value: 'India', regions: [{ value: 'India', cities: ['Mumbai', 'Delhi', 'Bengaluru', 'Other'] }] },
  { value: 'Indonesia', regions: [{ value: 'Indonesia', cities: ['Jakarta', 'Surabaya', 'Other'] }] },
  { value: 'Ireland', regions: [{ value: 'Ireland', cities: ['Dublin', 'Cork', 'Other'] }] },
  { value: 'Italy', regions: [{ value: 'Italy', cities: ['Rome', 'Milan', 'Other'] }] },
  { value: 'Japan', regions: [{ value: 'Japan', cities: ['Tokyo', 'Osaka', 'Yokohama', 'Other'] }] },
  { value: 'Mexico', regions: [{ value: 'Mexico', cities: ['Mexico City', 'Guadalajara', 'Other'] }] },
  { value: 'Myanmar', regions: [{ value: 'Myanmar', cities: ['Yangon', 'Mandalay', 'Other'] }] },
  { value: 'Netherlands', regions: [{ value: 'Netherlands', cities: ['Amsterdam', 'Rotterdam', 'Other'] }] },
  { value: 'New Zealand', regions: [{ value: 'New Zealand', cities: ['Auckland', 'Wellington', 'Other'] }] },
  { value: 'Norway', regions: [{ value: 'Norway', cities: ['Oslo', 'Other'] }] },
  { value: 'Pakistan', regions: [{ value: 'Pakistan', cities: ['Karachi', 'Lahore', 'Islamabad', 'Other'] }] },
  { value: 'Philippines', regions: [{ value: 'Philippines', cities: ['Manila', 'Cebu', 'Other'] }] },
  { value: 'Poland', regions: [{ value: 'Poland', cities: ['Warsaw', 'Krakow', 'Other'] }] },
  { value: 'Portugal', regions: [{ value: 'Portugal', cities: ['Lisbon', 'Porto', 'Other'] }] },
  { value: 'Russia', regions: [{ value: 'Russia', cities: ['Moscow', 'Saint Petersburg', 'Other'] }] },
  { value: 'Saudi Arabia', regions: [{ value: 'Saudi Arabia', cities: ['Riyadh', 'Jeddah', 'Other'] }] },
  { value: 'South Korea', regions: [{ value: 'South Korea', cities: ['Seoul', 'Busan', 'Other'] }] },
  { value: 'Spain', regions: [{ value: 'Spain', cities: ['Madrid', 'Barcelona', 'Other'] }] },
  { value: 'Sweden', regions: [{ value: 'Sweden', cities: ['Stockholm', 'Gothenburg', 'Other'] }] },
  { value: 'Switzerland', regions: [{ value: 'Switzerland', cities: ['Zurich', 'Geneva', 'Other'] }] },
  { value: 'Thailand', regions: [{ value: 'Thailand', cities: ['Bangkok', 'Chiang Mai', 'Other'] }] },
  { value: 'Turkey', regions: [{ value: 'Turkey', cities: ['Istanbul', 'Ankara', 'Other'] }] },
  { value: 'United Arab Emirates', regions: [{ value: 'United Arab Emirates', cities: ['Dubai', 'Abu Dhabi', 'Other'] }] },
  { value: 'Vietnam', regions: [{ value: 'Vietnam', cities: ['Ho Chi Minh City', 'Hanoi', 'Other'] }] },
  { value: 'Other', regions: [{ value: 'Other', cities: ['Other'] }] },
]

const selectOptionStyle = { background: '#141414' }

function countryFor(value: string) {
  return LOCATION_COUNTRIES.find((country) => country.value === value)
}

function regionFor(country: string, region: string) {
  return countryFor(country)?.regions.find((row) => row.value === region)
}

function joinParts(parts: string[]) {
  return parts.map((part) => part.trim()).filter(Boolean).join(' / ')
}

function splitLocationValue(value?: string) {
  const parts = (value ?? '').split(' / ').map((part) => part.trim()).filter(Boolean)
  const rawCountry = parts[0] ?? ''
  const country = rawCountry && countryFor(rawCountry) ? rawCountry : rawCountry ? 'Other' : ''
  const countryOther = country === 'Other' && rawCountry !== 'Other' ? rawCountry : ''
  const countryOption = countryFor(country)
  const rawRegion = parts[1] ?? ''
  const region = rawRegion && countryOption?.regions.some((row) => row.value === rawRegion) ? rawRegion : rawRegion ? 'Other' : ''
  const regionOther = region === 'Other' && rawRegion !== 'Other' ? rawRegion : ''
  const regionOption = countryOption?.regions.find((row) => row.value === region)
  const rawCity = parts.slice(2).join(' / ')
  const city = rawCity && regionOption?.cities.includes(rawCity) ? rawCity : rawCity ? 'Other' : ''
  const cityOther = city === 'Other' && rawCity !== 'Other' ? rawCity : ''
  return { country, countryOther, region, regionOther, city, cityOther }
}

function splitAddressValue(value?: string) {
  const parts = (value ?? '').split(' / ').map((part) => part.trim()).filter(Boolean)
  const rawCountry = parts[0] ?? ''
  const country = rawCountry && countryFor(rawCountry) ? rawCountry : rawCountry ? 'Other' : ''
  const countryOther = country === 'Other' && rawCountry !== 'Other' ? rawCountry : ''
  const countryOption = countryFor(country)

  if (countryOption) {
    const maybeRegion = parts[1] ?? ''
    const regionOption = countryOption.regions.find((row) => row.value === maybeRegion)
    if (!regionOption) {
      return { country, countryOther, region: maybeRegion ? 'Other' : '', regionOther: maybeRegion === 'Other' ? '' : maybeRegion, city: '', cityOther: '', detail: parts.slice(maybeRegion ? 2 : 1).join(' / ') }
    }

    const maybeCity = parts[2] ?? ''
    const hasCity = regionOption.cities.includes(maybeCity)
    return {
      country,
      countryOther,
      region: maybeRegion,
      regionOther: '',
      city: hasCity ? maybeCity : '',
      cityOther: '',
      detail: parts.slice(hasCity ? 3 : 2).join(' / '),
    }
  }

  return { country: '', countryOther: '', region: '', regionOther: '', city: '', cityOther: '', detail: value ?? '' }
}

function actualCountry(parts: { country: string; countryOther: string }) {
  return parts.country === 'Other' ? parts.countryOther || 'Other' : parts.country
}

function actualRegion(parts: { region: string; regionOther: string }) {
  return parts.region === 'Other' ? parts.regionOther || 'Other' : parts.region
}

function actualCity(parts: { city: string; cityOther: string }) {
  return parts.city === 'Other' ? parts.cityOther || 'Other' : parts.city
}

function hasUnfilledOther(value: string | null | undefined) {
  return (value ?? '').split(' / ').some((part) => part.trim() === 'Other')
}

function CountrySelectField({
  value,
  onChange,
  disabled,
}: {
  value?: string | null
  onChange: (value: string) => void
  disabled: boolean
}) {
  const selected = value && countryFor(value) ? value : value ? 'Other' : ''
  return (
    <div className="space-y-3">
      <select
        style={fieldStyle}
        disabled={disabled}
        value={selected}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="" style={selectOptionStyle}>—</option>
        {LOCATION_COUNTRIES.map((country) => (
          <option key={country.value} value={country.value} style={selectOptionStyle}>
            {country.value}
          </option>
        ))}
      </select>
      {selected === 'Other' ? (
        <input
          style={fieldStyle}
          disabled={disabled}
          value={value && !countryFor(value) ? value : ''}
          placeholder="Other country / nationality"
          onChange={(event) => onChange(event.target.value)}
        />
      ) : null}
    </div>
  )
}

function LocationSelectField({
  value,
  onChange,
  disabled,
}: {
  value?: string | null
  onChange: (value: string) => void
  disabled: boolean
}) {
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
          style={fieldStyle}
          disabled={disabled}
          value={parts.country}
          onChange={(event) => commit({ country: event.target.value, countryOther: '', region: '', regionOther: '', city: '', cityOther: '' })}
        >
          <option value="" style={selectOptionStyle}>Country / Region</option>
          {LOCATION_COUNTRIES.map((country) => (
            <option key={country.value} value={country.value} style={selectOptionStyle}>
              {country.value}
            </option>
          ))}
        </select>
        <select
          aria-label="Province / State"
          style={fieldStyle}
          disabled={disabled || regions.length === 0}
          value={parts.region}
          onChange={(event) => commit({ ...parts, region: event.target.value, regionOther: '', city: '', cityOther: '' })}
        >
          <option value="" style={selectOptionStyle}>Province / State</option>
          {regions.map((region) => (
            <option key={region.value} value={region.value} style={selectOptionStyle}>
              {region.value}
            </option>
          ))}
        </select>
        <select
          aria-label="City"
          style={fieldStyle}
          disabled={disabled || cities.length === 0}
          value={parts.city}
          onChange={(event) => commit({ ...parts, city: event.target.value, cityOther: '' })}
        >
          <option value="" style={selectOptionStyle}>City</option>
          {cities.map((city) => (
            <option key={city} value={city} style={selectOptionStyle}>
              {city}
            </option>
          ))}
        </select>
      </div>
      {(parts.country === 'Other' || parts.region === 'Other' || parts.city === 'Other') ? (
        <div className="grid sm:grid-cols-3 gap-3">
          {parts.country === 'Other' ? (
            <input style={fieldStyle} disabled={disabled} value={parts.countryOther} placeholder="Other country" onChange={(event) => commit({ ...parts, countryOther: event.target.value })} />
          ) : <div />}
          {parts.region === 'Other' ? (
            <input style={fieldStyle} disabled={disabled} value={parts.regionOther} placeholder="Other province / state" onChange={(event) => commit({ ...parts, regionOther: event.target.value })} />
          ) : <div />}
          {parts.city === 'Other' ? (
            <input style={fieldStyle} disabled={disabled} value={parts.cityOther} placeholder="Other city" onChange={(event) => commit({ ...parts, cityOther: event.target.value })} />
          ) : <div />}
        </div>
      ) : null}
    </div>
  )
}

function AddressSelectField({
  value,
  onChange,
  disabled,
}: {
  value?: string | null
  onChange: (value: string) => void
  disabled: boolean
}) {
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
          style={fieldStyle}
          disabled={disabled}
          value={parts.country}
          onChange={(event) => commit({ country: event.target.value, countryOther: '', region: '', regionOther: '', city: '', cityOther: '', detail: parts.detail })}
        >
          <option value="" style={selectOptionStyle}>Country / Region</option>
          {LOCATION_COUNTRIES.map((country) => (
            <option key={country.value} value={country.value} style={selectOptionStyle}>
              {country.value}
            </option>
          ))}
        </select>
        <select
          aria-label="Province / State"
          style={fieldStyle}
          disabled={disabled || regions.length === 0}
          value={parts.region}
          onChange={(event) => commit({ ...parts, region: event.target.value, regionOther: '', city: '', cityOther: '' })}
        >
          <option value="" style={selectOptionStyle}>Province / State</option>
          {regions.map((region) => (
            <option key={region.value} value={region.value} style={selectOptionStyle}>
              {region.value}
            </option>
          ))}
        </select>
        <select
          aria-label="City"
          style={fieldStyle}
          disabled={disabled || cities.length === 0}
          value={parts.city}
          onChange={(event) => commit({ ...parts, city: event.target.value, cityOther: '' })}
        >
          <option value="" style={selectOptionStyle}>City</option>
          {cities.map((city) => (
            <option key={city} value={city} style={selectOptionStyle}>
              {city}
            </option>
          ))}
        </select>
      </div>
      {(parts.country === 'Other' || parts.region === 'Other' || parts.city === 'Other') ? (
        <div className="grid sm:grid-cols-3 gap-3">
          {parts.country === 'Other' ? (
            <input style={fieldStyle} disabled={disabled} value={parts.countryOther} placeholder="Other country" onChange={(event) => commit({ ...parts, countryOther: event.target.value })} />
          ) : <div />}
          {parts.region === 'Other' ? (
            <input style={fieldStyle} disabled={disabled} value={parts.regionOther} placeholder="Other province / state" onChange={(event) => commit({ ...parts, regionOther: event.target.value })} />
          ) : <div />}
          {parts.city === 'Other' ? (
            <input style={fieldStyle} disabled={disabled} value={parts.cityOther} placeholder="Other city" onChange={(event) => commit({ ...parts, cityOther: event.target.value })} />
          ) : <div />}
        </div>
      ) : null}
      <textarea
        rows={2}
        aria-label="Detail address"
        placeholder="Detail address 詳細地址"
        style={{ ...fieldStyle, resize: 'none' }}
        disabled={disabled}
        value={parts.detail}
        onChange={(event) => commit({ ...parts, detail: event.target.value })}
      />
    </div>
  )
}

const KYC_PENDING_FILE_CATEGORIES = ['id', 'address', 'financial', 'other'] as const
type KycPendingCategory = (typeof KYC_PENDING_FILE_CATEGORIES)[number]

const DOC_TYPE_FOR_CATEGORY: Record<KycPendingCategory, string> = {
  id: 'KYC_ID',
  address: 'KYC_ADDRESS',
  financial: 'KYC_FINANCIAL',
  other: 'KYC_OTHER',
}

function UploadZone({
  slotId,
  personId,
  category,
  docType,
  isLocked,
  uploads,
  setUploads,
  pendingFiles,
  setPendingFiles,
  hint,
  required = false,
}: {
  slotId: string
  personId: string | undefined
  category: KycPendingCategory
  docType: string
  isLocked: boolean
  uploads: Record<string, { name: string; status: string }[]>
  setUploads: React.Dispatch<React.SetStateAction<Record<string, { name: string; status: string }[]>>>
  pendingFiles: Record<string, { uid: string; file: File }[]>
  setPendingFiles: React.Dispatch<
    React.SetStateAction<Record<string, { uid: string; file: File }[]>>
  >
  hint: string
  required?: boolean
}) {
  const t = useTranslations('kyc')
  const serverUploadKey = personId ? `${personId}:${category}` : ''
  const pendingKey = `${slotId}:${category}`

  const onDrop = useCallback(
    async (files: File[]) => {
      if (!slotId) return
      if (personId) {
        const uploadKey = serverUploadKey
        for (const file of files) {
          setUploads((u) => ({
            ...u,
            [uploadKey]: [...(u[uploadKey] ?? []), { name: file.name, status: 'uploading' }],
          }))
          try {
            const fd = new FormData()
            fd.append('file', file)
            fd.append('type', docType)
            fd.append('keyPersonId', personId)
            const res = await fetch('/api/documents/upload', { method: 'POST', body: fd })
            if (!res.ok) throw new Error()
            setUploads((u) => ({
              ...u,
              [uploadKey]: (u[uploadKey] ?? []).map((x) =>
                x.name === file.name ? { ...x, status: 'done' } : x
              ),
            }))
            toast.success(t('uploaded', { defaultValue: 'Uploaded' }))
          } catch {
            setUploads((u) => ({
              ...u,
              [uploadKey]: (u[uploadKey] ?? []).map((x) =>
                x.name === file.name ? { ...x, status: 'error' } : x
              ),
            }))
          }
        }
        return
      }

      for (const file of files) {
        const uid =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`
        setPendingFiles((p) => ({
          ...p,
          [pendingKey]: [...(p[pendingKey] ?? []), { uid, file }],
        }))
      }
      toast.message(
        t('pendingUploadQueued', {
          defaultValue:
            files.length === 1
              ? 'File stored locally — it will upload when you save draft or submit.'
              : 'Files stored locally — they will upload when you save draft or submit.',
        })
      )
    },
    [
      slotId,
      personId,
      serverUploadKey,
      pendingKey,
      docType,
      setUploads,
      setPendingFiles,
      t,
    ]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': [], 'image/jpeg': [], 'image/png': [] },
    maxSize: 10 * 1024 * 1024,
    onDrop,
    disabled: isLocked || !slotId,
  })

  const pendingList = pendingFiles[pendingKey] ?? []
  const serverList = serverUploadKey ? uploads[serverUploadKey] ?? [] : []

  function removePending(uid: string) {
    setPendingFiles((p) => {
      const next = { ...p }
      const list = next[pendingKey]?.filter((x) => x.uid !== uid) ?? []
      if (list.length) next[pendingKey] = list
      else delete next[pendingKey]
      return next
    })
  }

  return (
    <div className="space-y-2 pt-3">
      <div
        {...getRootProps()}
        className="rounded-lg p-4 flex flex-col items-center gap-2 text-center cursor-pointer transition-all"
        style={{
          border: `2px dashed ${isDragActive ? '#C9A96E' : '#2A2418'}`,
          background: isDragActive ? 'rgba(201,169,110,0.06)' : 'var(--background)',
          opacity: isLocked || !slotId ? 0.5 : 1,
          pointerEvents: isLocked || !slotId ? 'none' : 'auto',
        }}
      >
        <input {...getInputProps()} />
        <Upload size={16} style={{ color: '#C9A96E' }} />
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          {required ? <span style={{ color: '#ef4444', fontWeight: 700 }}>* </span> : null}
          {hint}
        </p>
        {required ? (
          <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: '#C9A96E' }}>
            Required upload
          </p>
        ) : null}
      </div>
      {pendingList.length > 0 ? (
        <ul className="space-y-1 text-xs">
          {pendingList.map((row) => (
            <li
              key={row.uid}
              className="flex items-center justify-between gap-2"
              style={{ color: 'var(--muted-foreground)' }}
            >
              <span>
                {row.file.name}{' '}
                <span style={{ opacity: 0.75 }}>
                  — {t('pendingLocal', { defaultValue: 'pending (saved after draft)' })}
                </span>
              </span>
              {!isLocked && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    removePending(row.uid)
                  }}
                  className="text-[10px] uppercase shrink-0"
                  style={{ color: '#f59e0b' }}
                >
                  {t('removePending', { defaultValue: 'Remove' })}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {serverList.length > 0 ? (
        <ul className="space-y-1 text-xs">
          {serverList.map((f, i) => (
            <li
              key={i}
              style={{
                color: f.status === 'error' ? '#ef4444' : f.status === 'done' ? '#10b981' : 'var(--muted-foreground)',
              }}
            >
              {f.name} — {f.status}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export default function KYCPage() {
  const t = useTranslations('kyc')
  const [step, setStep] = useState(0)
  const [ap, setAp] = useState(0)
  const [loading, setLoading] = useState(false)
  const [uploads, setUploads] = useState<Record<string, { name: string; status: string }[]>>({})
  const [pendingKycUploads, setPendingKycUploads] = useState<
    Record<string, { uid: string; file: File }[]>
  >({})
  const [existingKycDocs, setExistingKycDocs] = useState<Record<string, string[]>>({})
  const contactAddressEditedRef = useRef<Record<string, boolean>>({})
  const fieldSlotIdsRef = useRef<string[]>([])
  const pendingUploadsRef = useRef(pendingKycUploads)

  pendingUploadsRef.current = pendingKycUploads

  const form = useForm<FormValues>({
    resolver: zodResolver(formZod) as never,
    defaultValues: { persons: [emptyPerson()] },
  })
  const { reset } = form
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'persons' })

  useEffect(() => {
    fieldSlotIdsRef.current = fields.map((f) => f.id)
  }, [fields])
  const employmentStatus = form.watch(`persons.${ap}.employmentStatus` as 'persons.0.employmentStatus')
  const personId = form.watch(`persons.${ap}.id` as 'persons.0.id')
  const kycStatus = form.watch(`persons.${ap}.kycStatus` as 'persons.0.kycStatus')
  const slotIdForAp = fields[ap]?.id ?? ''

  const load = useCallback(() => {
    fetch('/api/kyc', { credentials: 'include' })
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) {
          toast.error(data?.error === 'Unauthorized' ? 'Please sign in to load KYC.' : (data?.error ?? 'Could not load KYC'))
          return
        }
        const list = data?.persons
        if (Array.isArray(list) && list.length > 0) {
          reset({
            persons: list.map((p: KeyPerson) => ({
              ...keyPersonToFormValues(p),
              kycStatus: p.kycStatus,
            })),
          })
          const docsByPerson: Record<string, string[]> = {}
          for (const p of list as Array<KeyPerson & { kycDocuments?: { documentType: string }[] }>) {
            docsByPerson[p.id] = (p.kycDocuments ?? []).map((doc) => doc.documentType)
          }
          setExistingKycDocs(docsByPerson)
          setUploads({})
          setPendingKycUploads({})
          contactAddressEditedRef.current = {}
        }
      })
      .catch(() => {
        toast.error('Could not load KYC')
      })
  }, [reset])

  useEffect(() => {
    load()
  }, [load])

  const isLocked = kycStatus === 'APPROVED'

  function stripForApi(persons: FormValues['persons']): KycPersonInput[] {
    return persons.map((p) => {
      const rest = { ...(p as KycPersonInput & { kycStatus?: string }) }
      delete rest.kycStatus
      return kycPersonZod.parse(rest)
    })
  }

  function hasRequiredUpload(personIndex: number, category: KycPendingCategory) {
    const slotId = fieldSlotIdsRef.current[personIndex]
    const person = form.getValues(`persons.${personIndex}` as 'persons.0')
    const docType = DOC_TYPE_FOR_CATEGORY[category]
    if (slotId && (pendingUploadsRef.current[`${slotId}:${category}`]?.length ?? 0) > 0) return true
    if (person?.id && existingKycDocs[person.id]?.includes(docType)) return true
    if (person?.id && (uploads[`${person.id}:${category}`] ?? []).some((doc) => doc.status === 'done')) return true
    return false
  }

  function composeNameForPerson(personIndex: number) {
    const p = form.getValues(`persons.${personIndex}` as 'persons.0')
    return [p.firstName, p.otherName, p.lastName].map((part) => part?.trim()).filter(Boolean).join(' ')
  }

  function validateSubmitRequirements() {
    const persons = form.getValues('persons')
    for (let i = 0; i < persons.length; i++) {
      const p = persons[i]
      const missing = [
        ['English first name', p.firstName],
        ['En last name / surname', p.lastName],
        ['ID type', p.idType],
        ['ID/passport number', p.idNumber],
        ['Place of issue', p.placeOfIssue],
        ['ID/passport expiry date', p.idExpiry],
        ['Date of birth', p.dateOfBirth],
        ['Place of birth', p.placeOfBirth],
        ['Nationality', p.nationality],
        ['Home address', p.homeAddress],
        ['Contact address', p.contactAddress],
        ['Mobile phone', p.mobile],
        ['Email', p.email],
      ].filter(([, value]) => !String(value ?? '').trim())

      if (missing.length > 0) {
        setAp(i)
        setStep(0)
        toast.error(`Please fill required KYC fields: ${missing.map(([label]) => label).join(', ')}`)
        return false
      }
      const unfilledOther = [
        ['Place of issue', p.placeOfIssue],
        ['Place of birth', p.placeOfBirth],
        ['Nationality', p.nationality],
        ['Home address', p.homeAddress],
        ['Contact address', p.contactAddress],
      ].find(([, value]) => hasUnfilledOther(value))
      if (unfilledOther) {
        setAp(i)
        setStep(0)
        toast.error(`Please fill the custom Other value for ${unfilledOther[0]}.`)
        return false
      }
      if (!hasRequiredUpload(i, 'id')) {
        setAp(i)
        setStep(0)
        toast.error('ID / passport upload is required. Please upload the file marked with *.')
        return false
      }
      if (!hasRequiredUpload(i, 'address')) {
        setAp(i)
        setStep(0)
        toast.error('Proof of address upload is required. Please upload the file marked with *.')
        return false
      }
    }
    return true
  }

  async function flushPendingAfterSave(slotIdsSnapshot: string[], backPersons: { id: string }[]) {
    const remaining = { ...pendingUploadsRef.current }
    let failed = 0

    for (let i = 0; i < backPersons.length; i++) {
      const sid = slotIdsSnapshot[i]
      const kpId = backPersons[i]?.id
      if (!sid || !kpId) continue

      for (const cat of KYC_PENDING_FILE_CATEGORIES) {
        const key = `${sid}:${cat}`
        const rows = remaining[key]
        if (!rows?.length) continue
        const stillPending: { uid: string; file: File }[] = []
        const docType = DOC_TYPE_FOR_CATEGORY[cat]

        for (const row of rows) {
          try {
            const fd = new FormData()
            fd.append('file', row.file)
            fd.append('type', docType)
            fd.append('keyPersonId', kpId)
            const res = await fetch('/api/documents/upload', { method: 'POST', body: fd })
            if (!res.ok) {
              const errJson = (await res.json().catch(() => ({}))) as { error?: string }
              throw new Error(errJson?.error ?? res.status.toString())
            }
            const serverKey = `${kpId}:${cat}`
            setUploads((u) => ({
              ...u,
              [serverKey]: [...(u[serverKey] ?? []), { name: row.file.name, status: 'done' }],
            }))
          } catch {
            stillPending.push(row)
            failed++
          }
        }
        if (stillPending.length) remaining[key] = stillPending
        else delete remaining[key]
      }
    }
    setPendingKycUploads(remaining)
    if (failed > 0) {
      toast.error(
        t('pendingUploadPartialFail', {
          defaultValue: `${failed} file(s) could not upload. Save again after checking your connection.`,
        })
      )
    }
  }

  async function saveAll(action: 'SAVE_DRAFT' | 'SUBMIT', opts: { advance?: boolean } = {}) {
    const currentPerson = form.getValues(`persons.${ap}` as 'persons.0')
    if ((opts.advance || action === 'SUBMIT') && currentPerson?.isPep) {
      toast.error(t('pepBlocked', { defaultValue: 'PEP selected as Yes. This KYC cannot continue online. Please contact our team.' }))
      return
    }
    if (action === 'SUBMIT') {
      if (!validateSubmitRequirements()) return
      const persons = form.getValues('persons')
      const missingDeclarationIndex = persons.findIndex((p) =>
        !p.signatureName?.trim() || !p.declarationDate || !p.declarationSigned
      )
      if (missingDeclarationIndex >= 0) {
        setAp(missingDeclarationIndex)
        setStep(3)
        toast.error(t('declarationRequired', { defaultValue: 'Please enter signature name, declaration date, and check the declaration before submitting.' }))
        return
      }
    }

    form.getValues('persons').forEach((_p, i) => {
      form.setValue(`persons.${i}.nameEn` as 'persons.0.nameEn', composeNameForPerson(i), { shouldDirty: true })
    })
    const ok = await form.trigger()
    if (!ok) return
    const slotIdsSnapshot = [...fieldSlotIdsRef.current]
    setLoading(true)
    try {
      const res = await fetch('/api/kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persons: stripForApi(form.getValues('persons')), action }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Save failed')
        return
      }
      const back = json.persons as { id: string; kycStatus: string; kycCode?: string | null }[]
      if (Array.isArray(back)) {
        back.forEach((b, i) => {
          form.setValue(`persons.${i}.id` as 'persons.0.id', b.id)
          form.setValue(`persons.${i}.kycStatus` as 'persons.0.kycStatus', b.kycStatus)
          form.setValue(`persons.${i}.kycCode` as 'persons.0.kycCode', b.kycCode ?? '')
        })
        await flushPendingAfterSave(slotIdsSnapshot, back)
      }
      if (action === 'SUBMIT') toast.success(t('submitSuccess'))
      else if (opts.advance && step < 3) setStep((s) => s + 1)
      else toast.success(t('draftSaved'))
    } finally {
      setLoading(false)
    }
  }

  async function removePerson(i: number) {
    if (fields.length <= 1) {
      toast.error(t('minOnePerson', { defaultValue: 'At least one person is required.' }))
      return
    }
    const slotId = fields[i]?.id
    const id = form.getValues(`persons.${i}.id` as 'persons.0.id')
    if (id) {
      setLoading(true)
      try {
        const res = await fetch(`/api/kyc/persons/${id}`, { method: 'DELETE' })
        if (!res.ok) {
          toast.error('Delete failed')
          return
        }
      } finally {
        setLoading(false)
      }
    }
    remove(i)
    if (ap >= fields.length - 1) setAp(Math.max(0, fields.length - 2))
    else if (i < ap) setAp((a) => a - 1)
    if (slotId) {
      setPendingKycUploads((p) => {
        const n = { ...p }
        for (const k of Object.keys(n)) {
          if (k.startsWith(`${slotId}:`)) delete n[k]
        }
        return n
      })
    }
    if (id) {
      setUploads((u) => {
        const n = { ...u }
        for (const k of Object.keys(n)) {
          if (k.startsWith(`${id}:`)) delete n[k]
        }
        return n
      })
    }
  }

  function addPerson() {
    append(emptyPerson())
    setAp(fields.length)
    setStep(0)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>{t('title')}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            {t('multiSubtitle', { defaultValue: 'Add every individual who must complete KYC. Fields match the official KYC form.' })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              window.location.href = '/api/kyc/export'
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border"
            style={{ borderColor: '#2A2418', color: '#C9A96E' }}
          >
            <Download size={14} />
            {t('downloadKycDoc', { defaultValue: 'Download Word' })}
          </button>
        </div>
      </div>

      {/* Person tabs */}
      <div
        className="rounded-xl p-3 flex flex-wrap items-center gap-2"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <Users size={16} style={{ color: '#C9A96E' }} className="ml-1" />
        {fields.map((f, i) => {
          const st = form.watch(`persons.${i}.kycStatus` as 'persons.0.kycStatus') ?? 'DRAFT'
          const nameEn = form.watch(`persons.${i}.nameEn` as 'persons.0.nameEn')
          const code = form.watch(`persons.${i}.kycCode` as 'persons.0.kycCode')
          const info = KYC_STATUS[st] ?? KYC_STATUS.DRAFT
          const label = nameEn?.trim() || `${t('personIndex', { defaultValue: 'Person' })} ${i + 1}`
          const personLocked = st === 'APPROVED'
          return (
            <div key={f.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setAp(i)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: i === ap ? 'rgba(201,169,110,0.2)' : 'var(--background)',
                  border: `1px solid ${i === ap ? '#C9A96E' : 'var(--border)'}`,
                  color: i === ap ? '#C9A96E' : 'var(--muted-foreground)',
                }}
              >
                {label}
                {code ? (
                  <span className="ml-1.5 text-[10px] opacity-90" style={{ color: '#F0EAD8' }}>
                    {code}
                  </span>
                ) : null}
                <span className="ml-1.5 text-[10px] opacity-80" style={{ color: info.text }}>
                  ({info.label})
                </span>
              </button>
              {!personLocked && (
                <button
                  type="button"
                  onClick={() => removePerson(i)}
                  className="p-1 rounded"
                  style={{ color: '#ef4444' }}
                  aria-label="Remove"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )
        })}
        <button
          type="button"
          onClick={addPerson}
          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm"
          style={{ color: '#C9A96E', border: '1px dashed #2A2418' }}
        >
          <Plus size={16} />
          {t('addPerson', { defaultValue: 'Add person' })}
        </button>
      </div>

      <div key={ap} className="space-y-6">
      <div
        className="rounded-xl p-4"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-0">
          {STEPS.map(({ key, icon: StepIcon }, i) => {
            const active = i === step
            const done = i < step
            return (
              <div key={key} className="flex items-center flex-1 last:flex-none">
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  className="flex flex-col items-center gap-1.5 flex-shrink-0"
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
                    style={{
                      background: done
                        ? 'rgba(16,185,129,0.15)'
                        : active
                          ? 'rgba(201,169,110,0.2)'
                          : 'var(--background)',
                      border: `1.5px solid ${done ? '#10b981' : active ? '#C9A96E' : 'var(--border)'}`,
                    }}
                  >
                    {done ? (
                      <CheckCircle2 size={16} style={{ color: '#10b981' }} />
                    ) : (
                      <StepIcon size={15} style={{ color: active ? '#C9A96E' : 'var(--muted-foreground)' }} />
                    )}
                  </div>
                  <span
                    className="text-xs font-medium hidden sm:block"
                    style={{ color: active ? '#C9A96E' : done ? '#10b981' : 'var(--muted-foreground)' }}
                  >
                    {t(key)}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <div
                    className="flex-1 h-px mx-2"
                    style={{ background: done ? '#10b981' : 'var(--border)' }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {step === 0 && (
        <div className="rounded-xl p-6 space-y-6" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#C9A96E' }}>{t('sectionA')}</h2>

          {/* Group 1: Title + Names */}
          <fieldset className="rounded-lg p-4 space-y-4" style={{ border: '1px solid var(--border)' }}>
            <legend className="text-xs px-1" style={{ color: 'var(--muted-foreground)' }}>Name 姓名</legend>
            <div className="grid sm:grid-cols-3 gap-4">
              <Field label={t('fields.title')} error={form.formState.errors.persons?.[ap]?.titlePrefix?.message}>
                <select style={fieldStyle} disabled={isLocked} {...form.register(`persons.${ap}.titlePrefix` as const)}>
                  <option value="" style={{ background: '#141414' }}>—</option>
                  <option value="Mr." style={{ background: '#141414' }}>Mr. 先生</option>
                  <option value="Ms." style={{ background: '#141414' }}>Ms. 女士</option>
                  <option value="Mrs." style={{ background: '#141414' }}>Mrs. 太太</option>
                </select>
              </Field>
              <Field label="English first name *" error={form.formState.errors.persons?.[ap]?.firstName?.message}>
                <input style={fieldStyle} disabled={isLocked} {...form.register(`persons.${ap}.firstName` as const)} />
              </Field>
              <Field label="En last name / surname *" error={form.formState.errors.persons?.[ap]?.lastName?.message}>
                <input style={fieldStyle} disabled={isLocked} {...form.register(`persons.${ap}.lastName` as const)} />
              </Field>
              <Field label={t('fields.nameZh')} error={form.formState.errors.persons?.[ap]?.nameZh?.message}>
                <input style={fieldStyle} disabled={isLocked} {...form.register(`persons.${ap}.nameZh` as const)} />
              </Field>
              <Field label="Other name">
                <input style={fieldStyle} disabled={isLocked} {...form.register(`persons.${ap}.otherName` as const)} />
              </Field>
            </div>
          </fieldset>

          {/* Group 2: ID */}
          <fieldset className="rounded-lg p-4 space-y-4" style={{ border: '1px solid var(--border)' }}>
            <legend className="text-xs px-1" style={{ color: 'var(--muted-foreground)' }}>{t('fields.idType')} &amp; {t('fields.idNumber')}</legend>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={`${t('fields.idType')} *`} error={form.formState.errors.persons?.[ap]?.idType?.message}>
                <select style={fieldStyle} disabled={isLocked} {...form.register(`persons.${ap}.idType` as const)}>
                  <option value="" style={{ background: '#141414' }}>—</option>
                  <option value="HKID" style={{ background: '#141414' }}>HK ID Card 香港身份證</option>
                  <option value="PASSPORT" style={{ background: '#141414' }}>Passport 護照</option>
                  <option value="OTHER" style={{ background: '#141414' }}>Other 其他</option>
                </select>
              </Field>
              <Field label={`${t('fields.idNumber')} *`} error={form.formState.errors.persons?.[ap]?.idNumber?.message}>
                <input style={fieldStyle} disabled={isLocked} {...form.register(`persons.${ap}.idNumber` as const)} />
              </Field>
            </div>
            <Field label={`${t('fields.placeOfIssue')} *`} error={form.formState.errors.persons?.[ap]?.placeOfIssue?.message}>
              <LocationSelectField
                value={form.watch(`persons.${ap}.placeOfIssue` as const)}
                disabled={isLocked}
                onChange={(value) => form.setValue(`persons.${ap}.placeOfIssue` as const, value, { shouldDirty: true, shouldValidate: true })}
              />
            </Field>
            <Field label={`${t('fields.expiryDate')} *`} error={form.formState.errors.persons?.[ap]?.idExpiry?.message}>
              <DatePickerField
                value={form.watch(`persons.${ap}.idExpiry` as const)}
                disabled={isLocked}
                onChange={(value) => form.setValue(`persons.${ap}.idExpiry` as const, value, { shouldDirty: true, shouldValidate: true })}
              />
            </Field>
            <UploadZone
              slotId={slotIdForAp}
              personId={personId}
              category="id"
              docType="KYC_ID"
              isLocked={isLocked}
              uploads={uploads}
              setUploads={setUploads}
              pendingFiles={pendingKycUploads}
              setPendingFiles={setPendingKycUploads}
              hint={t('uploadIdHint', { defaultValue: 'Upload ID / Passport copy — PDF, JPG, PNG, max 10 MB' })}
              required
            />
          </fieldset>

          <fieldset className="rounded-lg p-4 space-y-4" style={{ border: '1px solid var(--border)' }}>
            <legend className="text-xs px-1" style={{ color: 'var(--muted-foreground)' }}>Birth and Nationality 出生及國籍</legend>
            <Field label={`${t('fields.dob')} *`} error={form.formState.errors.persons?.[ap]?.dateOfBirth?.message}>
              <DatePickerField
                value={form.watch(`persons.${ap}.dateOfBirth` as const)}
                disabled={isLocked}
                onChange={(value) => form.setValue(`persons.${ap}.dateOfBirth` as const, value, { shouldDirty: true, shouldValidate: true })}
              />
            </Field>
            <Field label={`${t('fields.placeOfBirth')} *`} error={form.formState.errors.persons?.[ap]?.placeOfBirth?.message}>
              <LocationSelectField
                value={form.watch(`persons.${ap}.placeOfBirth` as const)}
                disabled={isLocked}
                onChange={(value) => form.setValue(`persons.${ap}.placeOfBirth` as const, value, { shouldDirty: true, shouldValidate: true })}
              />
            </Field>
            <Field label={`${t('fields.nationality')} *`} error={form.formState.errors.persons?.[ap]?.nationality?.message}>
              <CountrySelectField
                value={form.watch(`persons.${ap}.nationality` as const)}
                disabled={isLocked}
                onChange={(value) => form.setValue(`persons.${ap}.nationality` as const, value, { shouldDirty: true, shouldValidate: true })}
              />
            </Field>
          </fieldset>
          {/* Address group */}
          <fieldset className="rounded-lg p-4 space-y-4" style={{ border: '1px solid var(--border)' }}>
            <legend className="text-xs px-1" style={{ color: 'var(--muted-foreground)' }}>{t('fields.homeAddress')} &amp; {t('fields.contactAddress')}</legend>
            <Field label={`${t('fields.homeAddress')} *`} error={form.formState.errors.persons?.[ap]?.homeAddress?.message}>
              <AddressSelectField
                value={form.watch(`persons.${ap}.homeAddress` as const)}
                disabled={isLocked}
                onChange={(value) => {
                  form.setValue(`persons.${ap}.homeAddress` as const, value, { shouldDirty: true, shouldValidate: true })
                  const contactPath = `persons.${ap}.contactAddress` as const
                  const currentContact = form.getValues(contactPath)
                  if (!contactAddressEditedRef.current[slotIdForAp] || !currentContact?.trim()) {
                    form.setValue(contactPath, value, { shouldDirty: true, shouldValidate: true })
                  }
                }}
              />
            </Field>
            <Field label={`${t('fields.contactAddress')} *`} error={form.formState.errors.persons?.[ap]?.contactAddress?.message}>
              <AddressSelectField
                value={form.watch(`persons.${ap}.contactAddress` as const)}
                disabled={isLocked}
                onChange={(value) => {
                  contactAddressEditedRef.current[slotIdForAp] = true
                  form.setValue(`persons.${ap}.contactAddress` as const, value, { shouldDirty: true, shouldValidate: true })
                }}
              />
            </Field>
            <UploadZone
              slotId={slotIdForAp}
              personId={personId}
              category="address"
              docType="KYC_ADDRESS"
              isLocked={isLocked}
              uploads={uploads}
              setUploads={setUploads}
              pendingFiles={pendingKycUploads}
              setPendingFiles={setPendingKycUploads}
              hint={t('uploadAddressHint', { defaultValue: 'Upload proof of address — PDF, JPG, PNG, max 10 MB' })}
              required
            />
          </fieldset>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label={`${t('fields.email')} *`} error={form.formState.errors.persons?.[ap]?.email?.message}>
              <input type="email" style={fieldStyle} disabled={isLocked} {...form.register(`persons.${ap}.email` as const)} />
            </Field>
            <Field label={`${t('fields.mobile')} *`} error={form.formState.errors.persons?.[ap]?.mobile?.message}>
              <input style={fieldStyle} disabled={isLocked} {...form.register(`persons.${ap}.mobile` as const)} />
            </Field>
            <Field label={t('fields.homePhone')}>
              <input style={fieldStyle} disabled={isLocked} {...form.register(`persons.${ap}.homePhone` as const)} />
            </Field>
            <Field label={t('fields.workPhone')}>
              <input style={fieldStyle} disabled={isLocked} {...form.register(`persons.${ap}.workPhone` as const)} />
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label={t('fields.wechat')}>
              <input style={fieldStyle} disabled={isLocked} {...form.register(`persons.${ap}.wechat` as const)} />
            </Field>
            <Field label={t('fields.emergencyContact')}>
              <input style={fieldStyle} disabled={isLocked} {...form.register(`persons.${ap}.emergencyContact` as const)} />
            </Field>
          </div>

          {/* US Citizen — Yes / No radio */}
          <div className="space-y-2">
            <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('fields.usCitizen')}</p>
            <div className="flex gap-6">
              {[{ val: true, label: 'Yes 是' }, { val: false, label: 'No 否' }].map(({ val, label }) => (
                <label key={String(val)} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    disabled={isLocked}
                    checked={form.watch(`persons.${ap}.isUsCitizen` as const) === val}
                    onChange={() => form.setValue(`persons.${ap}.isUsCitizen` as const, val)}
                  />
                  <span className="text-sm" style={{ color: 'var(--foreground)' }}>{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="rounded-xl p-6 space-y-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#C9A96E' }}>{t('sectionB')}</h2>
          <Field label={t('fields.employmentStatus')}>
            <select style={fieldStyle} disabled={isLocked} {...form.register(`persons.${ap}.employmentStatus` as const)}>
              <option value="" style={{ background: '#141414' }}>—</option>
              <option value="EMPLOYED" style={{ background: '#141414' }}>{t('employment.employed')}</option>
              <option value="SELF_EMPLOYED" style={{ background: '#141414' }}>{t('employment.selfEmployed')}</option>
              <option value="RETIRED" style={{ background: '#141414' }}>{t('employment.retired')}</option>
              <option value="UNEMPLOYED" style={{ background: '#141414' }}>{t('employment.unemployed')}</option>
            </select>
          </Field>
          {(employmentStatus === 'EMPLOYED' || employmentStatus === 'SELF_EMPLOYED') && (
            <div className="space-y-4">
              <Field label={t('fields.employerName')}>
                <input style={fieldStyle} disabled={isLocked} {...form.register(`persons.${ap}.employerName` as const)} />
              </Field>
              <Field label={t('fields.companyAddress')}>
                <AddressSelectField
                  value={form.watch(`persons.${ap}.employerAddress` as const)}
                  disabled={isLocked}
                  onChange={(value) => form.setValue(`persons.${ap}.employerAddress` as const, value, { shouldDirty: true, shouldValidate: true })}
                />
              </Field>

              {/* Nature of Business — multi-checkbox grid */}
              <div className="space-y-2">
                <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('fields.businessNature')}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { val: 'Property investment', label: 'Property investment 物業投資' },
                    { val: 'Financial institution', label: 'Financial institution 金融機構' },
                    { val: 'Trading', label: 'Trading 貿易' },
                    { val: 'Manufacturing', label: 'Manufacturing 製造業' },
                    { val: 'Agent/Consultancy', label: 'Agent/Consultancy 代理或諮詢業務' },
                    { val: 'Investment holding', label: 'Investment holding 投資控股' },
                    { val: 'Financial service', label: 'Financial service 金融服務業' },
                    { val: 'Dormant', label: 'Dormant 不活躍' },
                    { val: 'IT', label: 'IT 資訊業' },
                    { val: 'Advertising', label: 'Advertising 廣告業' },
                    { val: 'Restaurant', label: 'Restaurant 飲食業' },
                    { val: 'Medical service', label: 'Medical service 醫療服務業' },
                  ].map(({ val, label }) => {
                    const current = (form.watch(`persons.${ap}.businessNaturesText` as const) ?? '').split(',').map((s: string) => s.trim()).filter(Boolean)
                    const checked = current.includes(val)
                    return (
                      <label key={val} className="flex items-start gap-2 cursor-pointer text-xs leading-snug" style={{ color: 'var(--foreground)' }}>
                        <input
                          type="checkbox"
                          disabled={isLocked}
                          checked={checked}
                          onChange={() => {
                            const next = checked ? current.filter((v: string) => v !== val) : [...current, val]
                            form.setValue(`persons.${ap}.businessNaturesText` as const, next.join(', '))
                          }}
                          className="mt-0.5 shrink-0"
                        />
                        {label}
                      </label>
                    )
                  })}
                </div>
                <Field label="Others (please specify) 其他 (請註明)">
                  <input
                    style={fieldStyle}
                    disabled={isLocked}
                    placeholder="Other business type..."
                    onBlur={(e) => {
                      const val = e.target.value.trim()
                      if (val) form.setValue(`persons.${ap}.businessNaturesText` as const, [...(form.watch(`persons.${ap}.businessNaturesText` as const) ?? '').split(',').map((s: string) => s.trim()).filter((s: string) => ['Property investment','Financial institution','Trading','Manufacturing','Agent/Consultancy','Investment holding','Financial service','Dormant','IT','Advertising','Restaurant','Medical service'].includes(s)), val].join(', '))
                    }}
                  />
                </Field>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label={t('fields.position')}>
                  <input style={fieldStyle} disabled={isLocked} {...form.register(`persons.${ap}.position` as const)} />
                </Field>
                <Field label={t('fields.workingYears')}>
                  <input type="number" min={0} max={80} style={fieldStyle} disabled={isLocked} {...form.register(`persons.${ap}.workingYears` as const, { valueAsNumber: true })} />
                </Field>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="rounded-xl p-6 space-y-6" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#C9A96E' }}>{t('sectionC')}</h2>

          {/* Source of Wealth — checkboxes */}
          <div className="space-y-2">
            <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('fields.sourceOfWealth')} 財富來源</p>
            <div className="space-y-2">
              {[
                { val: 'Salary/Bonus', label: 'Salary and/or Bonus 薪金與花紅' },
                { val: 'Investment', label: 'Investment 投資' },
                { val: 'Inheritance', label: 'Inheritance 承繼' },
                { val: 'Saving', label: 'Saving 儲蓄' },
                { val: 'Business Return', label: 'Business Return 生意' },
              ].map(({ val, label }) => {
                const current = (form.watch(`persons.${ap}.sourcesOfWealthText` as const) ?? '').split(',').map((s: string) => s.trim()).filter(Boolean)
                const checked = current.includes(val)
                return (
                  <label key={val} className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--foreground)' }}>
                    <input type="checkbox" disabled={isLocked} checked={checked} onChange={() => {
                      const next = checked ? current.filter((v: string) => v !== val) : [...current, val]
                      form.setValue(`persons.${ap}.sourcesOfWealthText` as const, next.join(', '))
                    }} />
                    {label}
                  </label>
                )
              })}
              <Field label="Others (please specify) 其他 (請註明)">
                <input style={fieldStyle} disabled={isLocked} placeholder="Specify other source..." onBlur={(e) => {
                  const FIXED = ['Salary/Bonus','Investment','Inheritance','Saving','Business Return']
                  const current = (form.watch(`persons.${ap}.sourcesOfWealthText` as const) ?? '').split(',').map((s: string) => s.trim()).filter((s: string) => FIXED.includes(s))
                  const val = e.target.value.trim()
                  if (val) form.setValue(`persons.${ap}.sourcesOfWealthText` as const, [...current, val].join(', '))
                }} />
              </Field>
            </div>
          </div>

          {/* Annual Income — radio */}
          <div className="space-y-2">
            <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('fields.annualIncome')} 年收入 (USD)</p>
            <div className="space-y-2">
              {['<100,000', '100,000–500,000', '500,001–1,000,000', '1,000,001+'].map((opt) => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--foreground)' }}>
                  <input type="radio" disabled={isLocked} value={opt} {...form.register(`persons.${ap}.annualIncome` as const)} />
                  {opt}
                </label>
              ))}
            </div>
          </div>

          {/* Net Value of Asset — radio */}
          <div className="space-y-2">
            <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('fields.netAssets')} 總資產 (USD)</p>
            <div className="space-y-2">
              {['<800,000', '800,001–3,000,000', '3,000,001+'].map((opt) => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--foreground)' }}>
                  <input type="radio" disabled={isLocked} value={opt} {...form.register(`persons.${ap}.netAssetValue` as const)} />
                  {opt}
                </label>
              ))}
            </div>
          </div>

          {/* Asset Items — checkboxes */}
          <div className="space-y-2">
            <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('fields.assetItems')} 資產項目</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: 'Property', label: 'Property 房產' },
                { val: 'Deposits', label: 'Deposits 存款' },
                { val: 'Securities', label: 'Securities 證券' },
                { val: 'Bonds/Fund', label: 'Bonds/Fund 債券/基金' },
                { val: 'Virtual Asset', label: 'Virtual Asset 虛擬資產' },
                { val: 'Insurance', label: 'Insurance 保險' },
              ].map(({ val, label }) => {
                const current = (form.watch(`persons.${ap}.assetItemsText` as const) ?? '').split(',').map((s: string) => s.trim()).filter(Boolean)
                const checked = current.includes(val)
                return (
                  <label key={val} className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--foreground)' }}>
                    <input type="checkbox" disabled={isLocked} checked={checked} onChange={() => {
                      const next = checked ? current.filter((v: string) => v !== val) : [...current, val]
                      form.setValue(`persons.${ap}.assetItemsText` as const, next.join(', '))
                    }} />
                    {label}
                  </label>
                )
              })}
            </div>
          </div>

          {/* PEP */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" disabled={isLocked} {...form.register(`persons.${ap}.isPep` as const)} className="mt-0.5" />
            <span className="text-sm" style={{ color: 'var(--foreground)' }}>{t('fields.isPep')}</span>
          </label>

          {/* Financial documents upload */}
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
              {t('financialDocuments', { defaultValue: 'Financial Documents' })}
            </p>
            <UploadZone
              slotId={slotIdForAp}
              personId={personId}
              category="financial"
              docType="KYC_FINANCIAL"
              isLocked={isLocked}
              uploads={uploads}
              setUploads={setUploads}
              pendingFiles={pendingKycUploads}
              setPendingFiles={setPendingKycUploads}
              hint={t('uploadFinancialHint', { defaultValue: 'Upload financial proof documents — PDF, JPG, PNG, max 10 MB' })}
            />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="rounded-xl p-6 space-y-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#C9A96E' }}>
              {t('otherCertifications', { defaultValue: 'Other Certification Files' })}
            </h2>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {t('otherCertificationsHint', { defaultValue: 'Upload any additional supporting certification files here.' })}
            </p>
            <UploadZone
              slotId={slotIdForAp}
              personId={personId}
              category="other"
              docType="KYC_OTHER"
              isLocked={isLocked}
              uploads={uploads}
              setUploads={setUploads}
              pendingFiles={pendingKycUploads}
              setPendingFiles={setPendingKycUploads}
              hint={t('uploadOtherHint', { defaultValue: 'Upload other certification files — PDF, JPG, PNG, max 10 MB' })}
            />
          </div>
          <div className="rounded-xl p-6 space-y-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#C9A96E' }}>{t('sectionD')}</h2>
            <Field label={t('signatureName', { defaultValue: 'Signatory (printed name)' })}>
              <input style={fieldStyle} disabled={isLocked} {...form.register(`persons.${ap}.signatureName` as const)} />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={t('declarationDate', { defaultValue: 'Date' })}>
                <DatePickerField
                  value={form.watch(`persons.${ap}.declarationDate` as const)}
                  disabled={isLocked}
                  onChange={(value) => form.setValue(`persons.${ap}.declarationDate` as const, value, { shouldDirty: true, shouldValidate: true })}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" disabled={isLocked} {...form.register(`persons.${ap}.declarationSigned` as const)} />
              <span className="text-sm" style={{ color: 'var(--foreground)' }}>{t('declaration')}</span>
            </label>
            {!isLocked && (
              <button
                type="button"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold"
                style={{ background: loading ? '#8A6E42' : '#C9A96E', color: '#0C0C0C' }}
              disabled={loading}
              onClick={() => saveAll('SUBMIT')}
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : null}
                {loading ? t('submitting') : t('submit')}
              </button>
            )}
          </div>
        </div>
      )}

      {step < 3 && !isLocked && (
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            disabled={step === 0 || loading}
            onClick={() => setStep((s) => s - 1)}
            className="px-5 py-2 rounded-lg text-sm font-medium"
            style={{ border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}
          >
            {t('back')}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => saveAll('SAVE_DRAFT')}
              className="px-5 py-2 rounded-lg text-sm font-medium"
              style={{ border: '1px solid var(--border)' }}
            >
              {loading ? t('saving') : t('saveDraft')}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => saveAll('SAVE_DRAFT', { advance: true })}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold"
              style={{ background: '#C9A96E', color: '#0C0C0C' }}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              {t('next')}
              {!loading && <ChevronRight size={14} />}
            </button>
          </div>
        </div>
      )}

      {step === 3 && !isLocked && (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={loading}
            onClick={() => saveAll('SAVE_DRAFT')}
            className="px-5 py-2 rounded-lg text-sm"
            style={{ border: '1px solid var(--border)' }}
          >
            {t('saveDraft')}
          </button>
        </div>
      )}
      </div>
    </div>
  )
}
