import { describe, expect, it } from 'vitest'
import { agingBucketFor, buildAgingReport, daysOverdue } from './aging'

const asOf = new Date('2026-06-12T00:00:00.000Z')

function doc(overrides: Partial<Parameters<typeof buildAgingReport>[0][number]>) {
  return {
    docId: 'd1',
    docNo: 'INV-1',
    partyId: 'p1',
    partyName: '客户甲',
    partyCode: 'C0001',
    docDate: new Date('2026-05-01T00:00:00.000Z'),
    dueDate: new Date('2026-05-31T00:00:00.000Z'),
    outstanding: 100,
    ...overrides,
  }
}

describe('aging buckets', () => {
  it('classifies by days overdue', () => {
    expect(agingBucketFor(-5)).toBe('notDue')
    expect(agingBucketFor(0)).toBe('notDue')
    expect(agingBucketFor(1)).toBe('d1to30')
    expect(agingBucketFor(30)).toBe('d1to30')
    expect(agingBucketFor(31)).toBe('d31to60')
    expect(agingBucketFor(60)).toBe('d31to60')
    expect(agingBucketFor(61)).toBe('d61to90')
    expect(agingBucketFor(90)).toBe('d61to90')
    expect(agingBucketFor(91)).toBe('d90plus')
  })

  it('falls back to doc date when no due date', () => {
    expect(daysOverdue({ docDate: new Date('2026-06-01T00:00:00.000Z'), dueDate: null }, asOf)).toBe(11)
  })
})

describe('aging report', () => {
  it('groups by party and sums buckets', () => {
    const report = buildAgingReport(
      [
        doc({ docId: 'a', docNo: 'INV-1', outstanding: 100, dueDate: new Date('2026-06-30T00:00:00.000Z') }), // not due
        doc({ docId: 'b', docNo: 'INV-2', outstanding: 200, dueDate: new Date('2026-05-31T00:00:00.000Z') }), // 12 days
        doc({ docId: 'c', docNo: 'INV-3', outstanding: 300, dueDate: new Date('2026-01-01T00:00:00.000Z') }), // 90+
        doc({ docId: 'd', docNo: 'INV-4', partyId: 'p2', partyName: '客户乙', partyCode: 'C0002', outstanding: 50, dueDate: new Date('2026-04-20T00:00:00.000Z') }), // 53 days
      ],
      asOf,
    )

    expect(report.parties).toHaveLength(2)
    const p1 = report.parties.find(row => row.partyId === 'p1')!
    expect(p1.buckets.notDue).toBe(100)
    expect(p1.buckets.d1to30).toBe(200)
    expect(p1.buckets.d90plus).toBe(300)
    expect(p1.total).toBe(600)

    const p2 = report.parties.find(row => row.partyId === 'p2')!
    expect(p2.buckets.d31to60).toBe(50)

    expect(report.totals.total).toBe(650)
    expect(report.totals.d1to30).toBe(200)
    // 金额大的排前面
    expect(report.parties[0]!.partyId).toBe('p1')
  })

  it('skips settled documents', () => {
    const report = buildAgingReport([doc({ outstanding: 0 })], asOf)
    expect(report.parties).toHaveLength(0)
    expect(report.totals.total).toBe(0)
  })
})
