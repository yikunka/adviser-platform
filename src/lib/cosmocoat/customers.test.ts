import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db/prisma', () => ({ prisma: {} }))

import { serializeCustomer } from './customers'

describe('serializeCustomer', () => {
  it('includes optional customer contact fields', () => {
    const row = serializeCustomer({
      id: 'cus_1',
      code: 'KH0001',
      name: 'Client A',
      userId: null,
      salesEmployeeId: 'emp_sales',
      technicalEmployeeId: 'emp_tech',
      phone: '1234',
      contactPerson: 'Alex',
      contactPhone: '5678',
      address: 'HK',
      productionEquipmentParams: 'Line A',
      createdById: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
      user: null,
      salesEmployee: {
        id: 'emp_sales',
        code: 'S001',
        name: 'Sales A',
        employeeType: 'SALES',
        position: null,
        department: null,
        phone: null,
        email: null,
        isActive: true,
      },
      technicalEmployee: {
        id: 'emp_tech',
        code: 'T001',
        name: 'Tech A',
        employeeType: 'TECHNICAL',
        position: null,
        department: null,
        phone: null,
        email: null,
        isActive: true,
      },
    })

    expect(row.contactPerson).toBe('Alex')
    expect(row.contactPhone).toBe('5678')
    expect(row.salesEmployee?.name).toBe('Sales A')
    expect(row.technicalEmployee?.name).toBe('Tech A')
  })
})
