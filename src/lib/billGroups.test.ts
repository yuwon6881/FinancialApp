import { describe, expect, it } from 'vitest'
import type { ActiveRecurringPayment, RecurringPayment } from '../types'
import { describeBillDue, getBillCycleState, groupBills } from './billGroups'

const today = new Date(2026, 9, 9, 12)

const bill = (overrides: Partial<RecurringPayment> = {}): RecurringPayment => ({
  id: 'rp', name: 'Gym', amount: 50, frequency: 'Monthly', category: 'Health', ledgerCategory: 'Essentials',
  accountId: 'a', nextDueDate: '2026-10-20', dueDate: 20, startDate: '2026-01-20', active: true, paymentMode: 'Manual',
  ...overrides,
})

const occ = (overrides: Partial<ActiveRecurringPayment> = {}): ActiveRecurringPayment => ({
  id: 'o', recurringPaymentId: 'rp', name: 'Gym', amount: 50, category: 'Health', ledgerCategory: 'Essentials',
  dueDate: '2026-10-20', isPaid: false, isDiscarded: false, status: 'Pending',
  ...overrides,
})

const fmt = (iso: string) => iso

describe('getBillCycleState', () => {
  it('files an unpaid occurrence by how far away it is', () => {
    expect(getBillCycleState(bill(), [occ({ dueDate: '2026-10-08' })], today)).toMatchObject({ group: 'overdue', daysAway: -1 })
    expect(getBillCycleState(bill(), [occ({ dueDate: '2026-10-09' })], today)).toMatchObject({ group: 'due-soon', daysAway: 0 })
    expect(getBillCycleState(bill(), [occ({ dueDate: '2026-10-15' })], today)).toMatchObject({ group: 'due-soon', daysAway: 6 })
    expect(getBillCycleState(bill(), [occ({ dueDate: '2026-10-16' })], today)).toMatchObject({ group: 'later', daysAway: 7 })
  })

  it('keeps a part-paid occurrence with the ones still owed', () => {
    const state = getBillCycleState(bill(), [occ({ status: 'PartiallyPaid', dueDate: '2026-10-10' })], today)
    expect(state.group).toBe('due-soon')
    expect(state.occurrence?.status).toBe('PartiallyPaid')
  })

  it('files a settled cycle as paid, dated by when it was paid', () => {
    const state = getBillCycleState(bill(), [occ({ status: 'Paid', isPaid: true, paidDate: '2026-10-03T08:00:00' })], today)
    expect(state).toMatchObject({ group: 'paid', date: '2026-10-03' })
    expect(describeBillDue(state, fmt)).toBe('Paid 2026-10-03')
  })

  it('falls back to the next due date when the cycle holds nothing for the bill', () => {
    expect(getBillCycleState(bill({ nextDueDate: '2027-01-01' }), [], today)).toMatchObject({ group: 'later', date: '2027-01-01' })
    expect(getBillCycleState(bill({ nextDueDate: null }), [], today)).toMatchObject({ group: 'later', date: null })
  })

  it('files paused and ended bills together, whatever they owe', () => {
    expect(getBillCycleState(bill({ active: false }), [occ({ dueDate: '2026-10-01' })], today).group).toBe('paused')
    const ended = getBillCycleState(bill({ endDate: '2026-09-30' }), [], today)
    expect(ended).toMatchObject({ group: 'paused', ended: true })
    expect(describeBillDue(ended, fmt)).toBe('Ended 2026-09-30')
  })
})

describe('describeBillDue', () => {
  it('says how near an unpaid bill is in words', () => {
    const say = (dueDate: string) => describeBillDue(getBillCycleState(bill(), [occ({ dueDate })], today), fmt)
    expect(say('2026-10-05')).toBe('4 days overdue')
    expect(say('2026-10-08')).toBe('Due yesterday')
    expect(say('2026-10-09')).toBe('Due today')
    expect(say('2026-10-10')).toBe('Due tomorrow')
    expect(say('2026-10-12')).toBe('Due in 3 days')
    expect(say('2026-10-27')).toBe('Due 2026-10-27')
  })
})

describe('groupBills', () => {
  it('orders the groups by urgency, keeps the incoming order inside each, and drops empty ones', () => {
    const rows = [
      { name: 'a', state: getBillCycleState(bill(), [occ({ dueDate: '2026-10-25' })], today) },
      { name: 'b', state: getBillCycleState(bill(), [occ({ dueDate: '2026-10-01' })], today) },
      { name: 'c', state: getBillCycleState(bill(), [occ({ dueDate: '2026-10-28' })], today) },
    ]
    expect(groupBills(rows).map(group => [group.label, group.rows.map(row => row.name)])).toEqual([
      ['Overdue', ['b']],
      ['Later', ['a', 'c']],
    ])
  })

  it('places Paid this cycle before Later', () => {
    const rows = [
      { name: 'youtube', state: getBillCycleState(bill({ nextDueDate: '2027-08-01' }), [], today) },
      { name: 'gym', state: getBillCycleState(bill(), [occ({ status: 'Paid', isPaid: true, paidDate: '2026-10-01' })], today) },
    ]
    expect(groupBills(rows).map(group => [group.label, group.rows.map(row => row.name)])).toEqual([
      ['Paid this cycle', ['gym']],
      ['Later', ['youtube']],
    ])
  })
})
