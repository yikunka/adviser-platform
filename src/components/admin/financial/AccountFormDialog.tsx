'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { flattenAccountHierarchy, isDescendantAccount } from '@/lib/financial/account-tree'

export type FinancialAccount = {
  id: string
  code: string
  name: string
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
  level: number
  sortOrder: number
  parentId: string | null
  isSystem: boolean
  notes?: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  account?: FinancialAccount | null
  accounts: FinancialAccount[]
  onSaved: () => void | Promise<void>
}

const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const
const modalContentClassName = 'financial-modal max-h-[90vh] overflow-y-auto border-[#2A2418] bg-[#11110E] text-[#FFF7E6] shadow-2xl ring-[#3A3428] sm:max-w-xl'
const modalFooterClassName = 'mt-4 border-[#2A2418] bg-[#16130E]'
const labelClassName = 'text-[#EADDC3]'
const fieldClassName = 'border-[#2A2418] bg-[#0E0E0A] text-[#FFF7E6] placeholder:text-[#9F927B]'
const selectContentClassName = 'financial-select-content border-[#2A2418] bg-[#11110E] text-[#FFF7E6]'
const secondaryButtonClassName = 'border-[#3A3428] bg-[#0E0E0A] text-[#FFF7E6] hover:bg-[#1E1A12] hover:text-[#FFF7E6]'

export function AccountFormDialog({ open, onOpenChange, account, accounts, onSaved }: Props) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<FinancialAccount['type']>('ASSET')
  const [parentId, setParentId] = useState('NONE')
  const [sortOrder, setSortOrder] = useState('0')
  const [isSystem, setIsSystem] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setCode(account?.code ?? '')
    setName(account?.name ?? '')
    setType(account?.type ?? 'ASSET')
    setParentId(account?.parentId ?? 'NONE')
    setSortOrder(String(account?.sortOrder ?? 0))
    setIsSystem(account?.isSystem ?? false)
  }, [account, open])

  const parentOptions = useMemo(() => {
    return flattenAccountHierarchy(accounts)
      .filter(candidate => {
        if (candidate.id === account?.id) return false
        if (candidate.level >= 4) return false
        if (account && isDescendantAccount(accounts, account.id, candidate.id)) return false
        return true
      })
  }, [account, accounts])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanCode = code.trim()
    const cleanName = name.trim()

    if (!cleanCode || !cleanName) {
      toast.error('Code and name are required.')
      return
    }

    const duplicate = accounts.find(item => item.code.toLowerCase() === cleanCode.toLowerCase() && item.id !== account?.id)
    if (duplicate) {
      toast.error('Account code already exists.')
      return
    }

    const selectedParent = parentId === 'NONE' ? null : accounts.find(item => item.id === parentId) ?? null
    if (parentId !== 'NONE' && !selectedParent) {
      toast.error('Parent account does not exist.')
      return
    }
    if (selectedParent && selectedParent.level >= 4) {
      toast.error('Parent account level is too deep.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(account ? `/api/admin/financial/accounts/${account.id}` : '/api/admin/financial/accounts', {
        method: account ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: cleanCode,
          name: cleanName,
          type,
          parentId: parentId === 'NONE' ? null : parentId,
          sortOrder: Number(sortOrder) || 0,
          isSystem,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.toast || data.error || 'Failed to save account.')

      toast.success(data.toast || (account ? 'Account updated.' : 'Account created.'))
      onOpenChange(false)
      await onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save account.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={modalContentClassName}>
        <DialogHeader>
          <DialogTitle className="text-[#FFF7E6]">{account ? 'Edit Account' : 'Add Account'}</DialogTitle>
          <DialogDescription className="text-[#B8AD98]">Maintain chart of accounts structure.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="account-code" className={labelClassName}>Code</Label>
              <Input id="account-code" value={code} onChange={event => setCode(event.target.value)} required className={fieldClassName} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-name" className={labelClassName}>Name</Label>
              <Input id="account-name" value={name} onChange={event => setName(event.target.value)} required className={fieldClassName} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className={labelClassName}>Type</Label>
              <Select value={type} onValueChange={value => setType(value as FinancialAccount['type'])}>
                <SelectTrigger className={`w-full ${fieldClassName}`}>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent className={selectContentClassName}>
                  {ACCOUNT_TYPES.map(item => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className={labelClassName}>Parent Account</Label>
              <Select value={parentId} onValueChange={value => setParentId(value ?? 'NONE')}>
                <SelectTrigger className={`w-full ${fieldClassName}`}>
                  <SelectValue placeholder="Parent account" />
                </SelectTrigger>
                <SelectContent className={selectContentClassName}>
                  <SelectItem value="NONE">No parent</SelectItem>
                  {parentOptions.map(item => (
                    <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sort-order" className={labelClassName}>Sort Order</Label>
              <Input id="sort-order" type="number" min={0} value={sortOrder} onChange={event => setSortOrder(event.target.value)} className={fieldClassName} />
            </div>
            <label className="flex items-center gap-2 pt-7 text-sm text-[#EADDC3]">
              <input
                type="checkbox"
                checked={isSystem}
                onChange={event => setIsSystem(event.target.checked)}
                className="size-4 accent-[#C9A96E]"
              />
              Is System
            </label>
          </div>

          <DialogFooter className={modalFooterClassName}>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className={secondaryButtonClassName}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} style={{ background: '#C9A96E', color: '#0A0805' }}>
              <Save size={14} />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
