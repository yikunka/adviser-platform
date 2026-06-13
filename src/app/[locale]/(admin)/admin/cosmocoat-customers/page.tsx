'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { toast } from 'sonner'
import { ContactRound, Mail, MapPin, Phone, Plus, Search, Upload } from 'lucide-react'
import type { CosCustomerRow } from '@/lib/cosmocoat/customers'

const card: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '0.75rem',
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.75rem 1rem',
  fontWeight: 500,
  fontSize: '0.8125rem',
  color: 'var(--muted-foreground)',
  background: '#111108',
  borderBottom: '1px solid #2A2418',
  whiteSpace: 'nowrap',
}

const td: React.CSSProperties = {
  padding: '0.75rem 1rem',
  fontSize: '0.875rem',
  color: 'var(--muted-foreground)',
  borderBottom: '1px solid #1E1C15',
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('zh-HK', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdminCosmoCoatCustomersPage() {
  const [customers, setCustomers] = useState<CosCustomerRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [importing, setImporting] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (search.trim()) params.set('q', search.trim())
      const res = await fetch(`/api/admin/cosmocoat/customers?${params}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '加载客户列表失败')
        return
      }
      setCustomers(data.customers ?? [])
      setTotal(data.total ?? 0)
      setTotalPages(data.totalPages ?? 1)
    } catch {
      toast.error('加载客户列表失败')
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    const timer = setTimeout(fetchCustomers, search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [fetchCustomers, search])

  useEffect(() => {
    setPage(1)
  }, [search])

  async function handleImport(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file) return

    setImporting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/cosmocoat/customers/import', {
        method: 'POST',
        body: fd,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? '导入失败')
      toast.success(`已导入 ${data.imported ?? 0} 位客户${data.skipped ? `，跳过 ${data.skipped} 行` : ''}`)
      if (importInputRef.current) importInputRef.current.value = ''
      setPage(1)
      await fetchCustomers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '导入失败')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>客户管理</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            共 {total} 位客户 · 统一管理原材料采购、配方服务与成品采购客户档案
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={e => handleImport(e.target.files)}
          />
          <button
            type="button"
            disabled={importing}
            onClick={() => importInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ border: '1px solid #2A2418', color: 'var(--foreground)' }}
          >
            <Upload size={16} />
            {importing ? '导入中...' : '导入表格'}
          </button>
          <Link
            href="/admin/cosmocoat-customers/new"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: '#C9A96E', color: '#0A0805' }}
          >
            <Plus size={16} />
            新建客户
          </Link>
        </div>
      </div>

      <div className="relative w-full max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜索客户编码、名称、电话、地址或账号..."
          className="w-full rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none"
          style={{ background: '#0E0E0A', border: '1px solid #2A2418', color: 'var(--foreground)' }}
        />
      </div>

      <div style={card}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['客户编码', '客户名称', '客户账号', '电话', '地址', '更新时间'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center" style={{ color: 'var(--muted-foreground)' }}>加载中...</td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <ContactRound size={28} style={{ color: '#C9A96E', opacity: 0.45 }} />
                      <span style={{ color: 'var(--muted-foreground)' }}>
                        {search ? '没有匹配的客户记录' : '暂无客户，点击「新建客户」添加'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : customers.map(customer => (
                <tr key={customer.id} className="hover:bg-[#1A1A12]/50 align-top">
                  <td style={td}>
                    <Link
                      href={`/admin/cosmocoat-customers/${customer.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                      style={{ color: '#C9A96E' }}
                    >
                      {customer.code}
                    </Link>
                  </td>
                  <td style={{ ...td, color: 'var(--foreground)' }} className="min-w-[160px]">{customer.name}</td>
                  <td style={td} className="min-w-[200px]">
                    {customer.user ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Mail size={13} style={{ color: '#756A58' }} />
                          <span className="break-all" style={{ color: 'var(--foreground)' }}>{customer.user.email}</span>
                        </div>
                        <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{customer.user.nameEn}</div>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--muted-foreground)' }}>—</span>
                    )}
                  </td>
                  <td style={td} className="min-w-[140px]">
                    <div className="flex items-center gap-2">
                      <Phone size={13} style={{ color: '#756A58' }} />
                      <span style={{ color: customer.phone ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                        {customer.phone ?? '—'}
                      </span>
                    </div>
                  </td>
                  <td style={td} className="min-w-[220px] max-w-[360px]">
                    <div className="flex items-start gap-2">
                      <MapPin size={13} className="mt-0.5 flex-shrink-0" style={{ color: '#756A58' }} />
                      <span className="whitespace-normal" style={{ color: customer.address ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                        {customer.address ?? '—'}
                      </span>
                    </div>
                  </td>
                  <td style={td} className="whitespace-nowrap">{formatDate(customer.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="px-3 py-1.5 rounded-lg text-sm disabled:opacity-40"
            style={{ border: '1px solid #2A2418', color: 'var(--foreground)' }}
          >
            上一页
          </button>
          <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{page} / {totalPages}</span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            className="px-3 py-1.5 rounded-lg text-sm disabled:opacity-40"
            style={{ border: '1px solid #2A2418', color: 'var(--foreground)' }}
          >
            下一页
          </button>
        </div>
      )}
    </div>
  )
}
