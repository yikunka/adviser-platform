'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { toast } from 'sonner'
import { MapPin, Phone, Plus, Search, Truck, Upload } from 'lucide-react'
import type { CosSupplierRow } from '@/lib/cosmocoat/suppliers'
import { useAdminPermission } from '@/components/admin/AdminPermissionContext'

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

export default function AdminCosmoCoatSuppliersPage() {
  const canViewDetail = useAdminPermission('cosmocoatSuppliers.view')
  const [suppliers, setSuppliers] = useState<CosSupplierRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [importing, setImporting] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)

  const fetchSuppliers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (search.trim()) params.set('q', search.trim())
      const res = await fetch(`/api/admin/cosmocoat/suppliers?${params}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '加载供应商列表失败')
        return
      }
      setSuppliers(data.suppliers ?? [])
      setTotal(data.total ?? 0)
      setTotalPages(data.totalPages ?? 1)
    } catch {
      toast.error('加载供应商列表失败')
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    const timer = setTimeout(fetchSuppliers, search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [fetchSuppliers, search])

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
      const res = await fetch('/api/admin/cosmocoat/suppliers/import', {
        method: 'POST',
        body: fd,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? '导入失败')
      toast.success(`已导入 ${data.imported ?? 0} 家供应商${data.skipped ? `，跳过 ${data.skipped} 行` : ''}`)
      if (importInputRef.current) importInputRef.current.value = ''
      setPage(1)
      await fetchSuppliers()
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
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>供应商管理</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            共 {total} 家供应商 · 独立管理 CosmoCoat 供应商档案与附件
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
            href="/admin/cosmocoat-suppliers/new"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: '#C9A96E', color: '#0A0805' }}
          >
            <Plus size={16} />
            新建供应商
          </Link>
        </div>
      </div>

      <div className="relative w-full max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜索供应商编码、名称、联系方式或地址..."
          className="w-full rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none"
          style={{ background: '#0E0E0A', border: '1px solid #2A2418', color: 'var(--foreground)' }}
        />
      </div>

      <div style={card}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['供应商编码', '供应商名称', '联系方式', '地址', '更新时间'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center" style={{ color: 'var(--muted-foreground)' }}>加载中...</td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Truck size={28} style={{ color: '#C9A96E', opacity: 0.45 }} />
                      <span style={{ color: 'var(--muted-foreground)' }}>
                        {search ? '没有匹配的供应商记录' : '暂无供应商，点击「新建供应商」添加'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : suppliers.map(supplier => (
                <tr key={supplier.id} className="hover:bg-[#1A1A12]/50 align-top">
                  <td style={td}>
                    {canViewDetail ? (
                      <Link
                        href={`/admin/cosmocoat-suppliers/${supplier.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                        style={{ color: '#C9A96E' }}
                      >
                        {supplier.code}
                      </Link>
                    ) : (
                      <span className="font-medium" style={{ color: 'var(--foreground)' }}>{supplier.code}</span>
                    )}
                  </td>
                  <td style={{ ...td, color: 'var(--foreground)' }} className="min-w-[180px]">{supplier.name}</td>
                  <td style={td} className="min-w-[200px]">
                    <div className="flex items-start gap-2">
                      <Phone size={13} className="mt-0.5 flex-shrink-0" style={{ color: '#756A58' }} />
                      <span className="whitespace-pre-wrap" style={{ color: supplier.contactInfo ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                        {supplier.contactInfo ?? '—'}
                      </span>
                    </div>
                  </td>
                  <td style={td} className="min-w-[240px] max-w-[420px]">
                    <div className="flex items-start gap-2">
                      <MapPin size={13} className="mt-0.5 flex-shrink-0" style={{ color: '#756A58' }} />
                      <span className="whitespace-normal" style={{ color: supplier.address ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                        {supplier.address ?? '—'}
                      </span>
                    </div>
                  </td>
                  <td style={td} className="whitespace-nowrap">{formatDate(supplier.updatedAt)}</td>
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
