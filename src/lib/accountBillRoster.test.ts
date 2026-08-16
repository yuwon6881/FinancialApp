import { describe, expect, it } from 'vitest'
import type { RecurringPayment } from '../types'
import { buildAccountBillRosters, createEmptyAccountBillRoster, formatBillDueDate } from './accountBillRoster'

const makePayment = (overrides: Partial<RecurringPayment> = {}): RecurringPayment => ({
  id: 'sub-1',
  name: 'Netflix',
  amount: 60,
  frequency: 'Monthly',
  category: 'Entertainment',
  ledgerCategory: 'Essentials',
  accountId: 'acc-1',
  nextDueDate: '2026-08-28',
  dueDate: 28,
  startDate: '2026-01-01',
  active: true,
  paymentMode: 'AutoDeduct',
  ...overrides,
})

describe('formatBillDueDate', () => {
  it('formats an ISO date into plain day month format', () => {
    expect(formatBillDueDate('2026-08-28')).toBe('28 Aug')
    expect(formatBillDueDate('2026-01-05')).toBe('5 Jan')
    expect(formatBillDueDate('2026-12-31')).toBe('31 Dec')
  })

  it('returns null for null, undefined, or invalid date strings', () => {
    expect(formatBillDueDate(null)).toBeNull()
    expect(formatBillDueDate(undefined)).toBeNull()
    expect(formatBillDueDate('')).toBeNull()
    expect(formatBillDueDate('invalid-date')).toBeNull()
  })
})

describe('createEmptyAccountBillRoster', () => {
  it('initializes a default empty roster', () => {
    const empty = createEmptyAccountBillRoster('acc-empty')
    expect(empty).toEqual({
      accountId: 'acc-empty',
      active: [],
      paused: [],
      monthlyTotal: 0,
      autoDeductCount: 0,
    })
  })
})

describe('buildAccountBillRosters', () => {
  const fixedToday = new Date(2026, 7, 17) // 2026-08-17

  it('normalizes annual bills into monthly equivalent (amount / 12)', () => {
    const payments: RecurringPayment[] = [
      makePayment({ id: 'sub-1', name: 'Domain Name', amount: 120, frequency: 'Annually', accountId: 'acc-1' }),
      makePayment({ id: 'sub-2', name: 'Internet', amount: 90, frequency: 'Monthly', accountId: 'acc-1' }),
    ]

    const rosters = buildAccountBillRosters(payments, fixedToday)
    const roster = rosters.get('acc-1')

    expect(roster).toBeDefined()
    expect(roster?.active).toHaveLength(2)
    expect(roster?.active.find(b => b.payment.id === 'sub-1')?.monthlyEquivalent).toBe(10)
    expect(roster?.active.find(b => b.payment.id === 'sub-2')?.monthlyEquivalent).toBe(90)
    expect(roster?.monthlyTotal).toBe(100)
  })

  it('routes ended bills into paused', () => {
    const payments: RecurringPayment[] = [
      makePayment({ id: 'sub-active', active: true, endDate: '2026-12-31' }),
      makePayment({ id: 'sub-ended', active: true, endDate: '2026-08-01' }),
    ]

    const rosters = buildAccountBillRosters(payments, fixedToday)
    const roster = rosters.get('acc-1')

    expect(roster?.active.map(b => b.payment.id)).toEqual(['sub-active'])
    expect(roster?.paused.map(b => b.payment.id)).toEqual(['sub-ended'])
  })

  it('routes inactive bills into paused', () => {
    const payments: RecurringPayment[] = [
      makePayment({ id: 'sub-paused', active: false, amount: 50 }),
      makePayment({ id: 'sub-active', active: true, amount: 100 }),
    ]

    const rosters = buildAccountBillRosters(payments, fixedToday)
    const roster = rosters.get('acc-1')

    expect(roster?.active.map(b => b.payment.id)).toEqual(['sub-active'])
    expect(roster?.paused.map(b => b.payment.id)).toEqual(['sub-paused'])
    expect(roster?.monthlyTotal).toBe(100) // paused bill excluded from monthly committed total
  })

  it('counts active auto-deduct bills correctly', () => {
    const payments: RecurringPayment[] = [
      makePayment({ id: 'sub-auto-1', active: true, paymentMode: 'AutoDeduct' }),
      makePayment({ id: 'sub-auto-2', active: true, paymentMode: 'AutoDeduct' }),
      makePayment({ id: 'sub-manual', active: true, paymentMode: 'Manual' }),
      makePayment({ id: 'sub-paused-auto', active: false, paymentMode: 'AutoDeduct' }),
    ]

    const rosters = buildAccountBillRosters(payments, fixedToday)
    const roster = rosters.get('acc-1')

    expect(roster?.autoDeductCount).toBe(2)
  })

  it('sorts bills by next due date ascending then by name', () => {
    const payments: RecurringPayment[] = [
      makePayment({ id: 'sub-3', name: 'Spotify', nextDueDate: '2026-08-25' }),
      makePayment({ id: 'sub-1', name: 'Apple Music', nextDueDate: '2026-08-10' }),
      makePayment({ id: 'sub-2', name: 'Adobe', nextDueDate: '2026-08-10' }),
      makePayment({ id: 'sub-4', name: 'Zendesk', nextDueDate: null }),
    ]

    const rosters = buildAccountBillRosters(payments, fixedToday)
    const roster = rosters.get('acc-1')

    expect(roster?.active.map(b => b.payment.name)).toEqual([
      'Adobe',
      'Apple Music',
      'Spotify',
      'Zendesk',
    ])
  })

  it('initializes empty rosters for accounts with no bills when accountIds is supplied', () => {
    const payments: RecurringPayment[] = [
      makePayment({ id: 'sub-1', accountId: 'acc-1' }),
    ]

    const rosters = buildAccountBillRosters(payments, fixedToday, ['acc-1', 'acc-2', 'acc-3'])

    expect(rosters.has('acc-1')).toBe(true)
    expect(rosters.has('acc-2')).toBe(true)
    expect(rosters.get('acc-2')).toEqual({
      accountId: 'acc-2',
      active: [],
      paused: [],
      monthlyTotal: 0,
      autoDeductCount: 0,
    })
  })

  it('indexes bills pointed at a closed or archived account for deletion-refusal visibility', () => {
    const payments: RecurringPayment[] = [
      makePayment({ id: 'sub-orphaned', name: 'Gym Membership', accountId: 'acc-closed' }),
    ]

    const rosters = buildAccountBillRosters(payments, fixedToday)
    const roster = rosters.get('acc-closed')

    expect(roster).toBeDefined()
    expect(roster?.active).toHaveLength(1)
    expect(roster?.active[0].payment.name).toBe('Gym Membership')
  })
})
