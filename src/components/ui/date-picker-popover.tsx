'use client'

import * as React from 'react'
import { CalendarIcon } from 'lucide-react'

import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export function parseYmd(value?: string | null): Date | undefined {
  if (!value) return undefined
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return undefined
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

export function formatYmd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function splitDatetimeLocal(s: string): { date: string; time: string } {
  if (!s?.includes?.('T')) return { date: '', time: '00:00' }
  const [d, tRaw] = s.split('T')
  const pad = (tRaw ?? '').slice(0, 5)
  const time = /^\d{2}:\d{2}$/.test(pad) ? pad : '00:00'
  return { date: d ?? '', time }
}

function mergeDatetimeLocal(date: string, time: string): string {
  if (!date.trim()) return ''
  const t = /^([01]\d|2[0-3]):([0-5]\d)$/.test(time.trim()) ? time.trim() : '00:00'
  return `${date}T${t}`
}

/** Replaces flaky `input[type=datetime-local]` (esp. Safari): calendar + HTML time. */
export function DatetimeLocalPicker({
  value,
  onChange,
  disabled,
  dateTriggerStyle,
  timeInputClassName,
  timeInputStyle,
  datePlaceholder,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  dateTriggerStyle?: React.CSSProperties
  timeInputClassName?: string
  timeInputStyle?: React.CSSProperties
  datePlaceholder?: string
}) {
  const { date: datePart, time: timePart } = splitDatetimeLocal(value)

  return (
    <div className={cn('flex min-w-0 flex-1 flex-wrap items-center gap-2')}>
      <div className="min-w-[8rem] flex-1">
        <DatePickerPopover
          value={datePart}
          onChange={(d) => onChange(mergeDatetimeLocal(d, timePart))}
          disabled={disabled}
          placeholder={datePlaceholder ?? 'Date'}
          style={dateTriggerStyle}
        />
      </div>
      <input
        type="time"
        disabled={disabled}
        value={datePart ? timePart : ''}
        onChange={(e) => onChange(mergeDatetimeLocal(datePart, e.target.value))}
        className={cn('min-w-[6rem] rounded-lg px-2 py-1.5 text-xs', timeInputClassName)}
        style={timeInputStyle}
      />
    </div>
  )
}

export type DatePickerPopoverProps = {
  id?: string
  name?: string
  /** `YYYY-MM-DD` or partial ISO date prefix */
  value?: string | null
  onChange: (value: string) => void
  disabled?: boolean
  required?: boolean
  placeholder?: string
  fromYear?: number
  toYear?: number
  className?: string
  style?: React.CSSProperties
}

export function DatePickerPopover({
  id,
  name,
  value,
  onChange,
  disabled,
  required,
  placeholder = 'YYYY-MM-DD',
  fromYear = 1900,
  toYear = 2100,
  className,
  style,
}: DatePickerPopoverProps) {
  const [open, setOpen] = React.useState(false)
  const selected = parseYmd(value)
  const minDate = React.useMemo(() => new Date(fromYear, 0, 1), [fromYear])
  const maxDate = React.useMemo(() => new Date(toYear, 11, 31), [toYear])
  const defaultBrowseMonth = React.useMemo(() => {
    const now = new Date()
    if (now.getTime() < minDate.getTime()) return minDate
    if (now.getTime() > maxDate.getTime()) return maxDate
    return now
  }, [minDate, maxDate])
  const display = value?.trim() ? String(value).slice(0, 10) : ''

  const labelText = display || placeholder

  return (
    <div className="relative w-full">
      {/* Keeps constraint validation usable inside native <form>s */}
      <input
        name={name}
        aria-hidden
        tabIndex={-1}
        readOnly
        required={required}
        value={display}
        autoComplete="off"
        className={cn(
          'pointer-events-none absolute left-0 top-0 z-[-1] m-0 h-px max-h-[1px] w-px max-w-[1px] overflow-hidden opacity-0',
          display ? '' : ''
        )}
      />
      <Popover open={open} onOpenChange={(next) => setOpen(next)}>
        <PopoverTrigger
          type="button"
          disabled={disabled}
          id={id}
          aria-expanded={open}
          className={cn(
            'flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2 text-left text-sm outline-none transition-colors disabled:opacity-50',
            className
          )}
          style={style}
        >
          <span style={{ opacity: display ? 1 : 0.65 }}>{labelText}</span>
          <CalendarIcon aria-hidden size={14} className="shrink-0 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          className={cn(
            'w-auto border-[#2A2418] bg-[#111111] p-2 shadow-lg ring-[#3A3428]'
          )}
        >
          {open ? (
            <Calendar
              mode="single"
              selected={selected}
              defaultMonth={selected ?? defaultBrowseMonth}
              captionLayout="dropdown"
              disabled={{ before: minDate, after: maxDate }}
              startMonth={minDate}
              endMonth={maxDate}
              classNames={{
                root: cn('w-fit text-[#F0EAD8]'),
                caption_label: cn('text-[#F0EAD8]'),
                weekdays: cn('text-[#C9A96E]/90'),
                day: cn('text-[#F0EAD8]'),
                outside: cn('text-muted-foreground'),
                disabled: cn('opacity-35'),
                today: cn('rounded-md bg-[#2A2418]/80'),
              }}
              onSelect={(date) => {
                if (!date) return
                onChange(formatYmd(date))
                setOpen(false)
              }}
            />
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  )
}
