import type { ActiveRecurringPayment, RecurringPayment, Transaction } from '../types'
import { getCycleRangeDates } from './cycle'
import { ordinalSuffix } from './cycleLabels'

export const BILL_TIMELINE_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

export interface BillTimelineNode {
  dueDate: string
  percent: number
  bills: ActiveRecurringPayment[]
}

export interface BillTimelineModel {
  startTime: number
  endTime: number
  durationMs: number
  startLabel: string
  endLabel: string
  processedPayments: ActiveRecurringPayment[]
  cycleTotal: number | null
  timelineNodes: BillTimelineNode[]
}

export function getBillTimelineAmount(payment: Pick<ActiveRecurringPayment, 'amount' | 'scheduledAmount'>): number | null {
  const amount = payment.scheduledAmount ?? payment.amount
  return amount == null || !Number.isFinite(amount) ? null : Math.abs(amount)
}

export interface BuildBillTimelineModelOptions {
  activeRecurringPayments: ActiveRecurringPayment[]
  allPayments?: RecurringPayment[]
  transactions?: Transaction[]
  selectedMonth: string
  selectedYear: number
  cycleDay: number
  cycleOffset?: number
  fallbackDate?: Date
}

const formatIso = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const parseBillTimelineDate = (iso: string): Date => {
  const [year, month, day] = iso.split('-').map(Number)
  return Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
    ? new Date(year, month - 1, day)
    : new Date(iso)
}

const toIsoDate = (raw: string | null | undefined): string => {
  if (!raw) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? raw : formatIso(parsed)
}

const isDiscardedTransaction = (transaction: Transaction) =>
  String(transaction.ledgerCategory || '').toLowerCase() === 'discarded'

function buildFuturePayments(
  allPayments: RecurringPayment[] | undefined,
  activeRecurringPayments: ActiveRecurringPayment[],
  year: number,
  monthIndex: number,
  startIso: string,
  endIso: string,
): ActiveRecurringPayment[] {
  if (!allPayments?.length) {
    return activeRecurringPayments.map(payment => {
      const day = payment.dueDay || Number.parseInt(payment.dueDate.split('-')[2] || '', 10) || 1
      const clampedDay = Math.min(day, new Date(year, monthIndex + 1, 0).getDate())
      return {
        id: `${payment.id}-upcoming-${year}-${monthIndex}`,
        recurringPaymentId: payment.id,
        name: payment.name,
        amount: payment.amount,
        category: payment.category,
        ledgerCategory: payment.ledgerCategory,
        dueDate: `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`,
        dueDay: clampedDay,
        isPaid: false,
        isDiscarded: false,
        status: 'Pending',
      }
    })
  }

  return allPayments.flatMap(payment => {
    if (payment.active === false || payment.startDate > endIso || (payment.endDate && payment.endDate < startIso)) return []
    if (payment.frequency === 'Annually') {
      const startMonth = Number.parseInt(payment.startDate.split('-')[1] || '', 10)
      if (startMonth && startMonth !== monthIndex + 1) return []
    }

    const clampedDay = Math.min(payment.dueDate, new Date(year, monthIndex + 1, 0).getDate())
    return [{
      id: `${payment.id}-upcoming-${year}-${monthIndex}`,
      recurringPaymentId: payment.id,
      name: payment.name,
      amount: payment.amount,
      category: payment.category,
      ledgerCategory: payment.ledgerCategory,
      dueDate: `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`,
      dueDay: clampedDay,
      isPaid: false,
      isDiscarded: false,
      status: 'Pending',
    }]
  })
}

function applyOccurrenceStatuses(
  rawList: ActiveRecurringPayment[],
  transactions: Transaction[],
  cycleOffset: number,
  startIso: string,
  endIso: string,
): ActiveRecurringPayment[] {
  const isInCycle = (rawDate: string | null | undefined) => {
    const iso = toIsoDate(rawDate)
    return Boolean(iso) && iso >= startIso && iso <= endIso
  }
  const matchedTransactionIds = new Set<string>()
  const representedPaymentIds = new Set(rawList.map(payment => payment.recurringPaymentId).filter(Boolean))

  const mapped = rawList.map(payment => {
    if (payment.isDiscarded || payment.status === 'Discarded') {
      return { ...payment, isPaid: false, isDiscarded: true, status: 'Discarded' as const }
    }

    const hasAuthoritativeStatus = cycleOffset === 0 &&
      (payment.status === 'Pending' || payment.status === 'PartiallyPaid' || payment.status === 'Paid' || payment.status === 'SettledByLoanPayoff')
    const isServerPaid = hasAuthoritativeStatus && (payment.status === 'Paid' || payment.status === 'SettledByLoanPayoff')
    const isPartiallyPaid = hasAuthoritativeStatus && payment.status === 'PartiallyPaid'
    if (isPartiallyPaid) {
      return { ...payment, isPaid: false, status: 'PartiallyPaid' as const }
    }
    const matchingTransaction = hasAuthoritativeStatus ? undefined : transactions.find(transaction => {
      if (transaction.recurringPaymentId === payment.recurringPaymentId &&
          transaction.recurringOccurrenceDate === payment.dueDate) return true
      if (!isInCycle(transaction.date)) return false
      if (!isServerPaid && transaction.recurringPaymentId === payment.recurringPaymentId) {
        const transactionDate = toIsoDate(transaction.date)
        const dueDate = toIsoDate(payment.dueDate)
        if (!isDiscardedTransaction(transaction) && dueDate && transactionDate > dueDate) return false
      }
      if (transaction.recurringPaymentId) return transaction.recurringPaymentId === payment.recurringPaymentId

      const description = (transaction.description || '').toLowerCase().trim()
      const category = (transaction.category || '').toLowerCase().trim()
      const name = payment.name.toLowerCase().trim()
      return description === name ||
        (name.length > 2 && description.includes(name)) ||
        (description.length > 2 && name.includes(description)) ||
        (category !== '' && category === name)
    })

    if (matchingTransaction) matchedTransactionIds.add(String(matchingTransaction.id))
    if (matchingTransaction && isDiscardedTransaction(matchingTransaction)) {
      return { ...payment, isPaid: false, isDiscarded: true, status: 'Discarded' as const }
    }
    if (isServerPaid || matchingTransaction) {
      return {
        ...payment,
        isPaid: true,
        status: payment.status === 'SettledByLoanPayoff' ? 'SettledByLoanPayoff' as const : 'Paid' as const,
        paidDate: payment.paidDate || matchingTransaction?.date || null,
      }
    }
    return payment
  })

  const historicalGroups = new Map<string, { dueDate: string; transactions: Transaction[] }>()
  for (const transaction of transactions) {
    if (matchedTransactionIds.has(String(transaction.id)) || !transaction.recurringPaymentId ||
        representedPaymentIds.has(transaction.recurringPaymentId)) continue
    // A pay-early row is posted today but belongs to the occurrence it names. Historical cycle
    // views therefore use RecurringOccurrenceDate first, with posting date only as a legacy
    // fallback for old tagged transactions.
    const dueDate = toIsoDate(transaction.recurringOccurrenceDate || transaction.date)
    if (!isInCycle(dueDate)) continue
    const key = `${transaction.recurringPaymentId}|${dueDate}`
    const group = historicalGroups.get(key)
    if (group) group.transactions.push(transaction)
    else historicalGroups.set(key, { dueDate, transactions: [transaction] })
  }

  const historical = [...historicalGroups.values()].map(({ dueDate, transactions: group }) => {
    const discarded = group.some(isDiscardedTransaction)
    const active = group.filter(transaction => !isDiscardedTransaction(transaction))
    const representative = active[0] ?? group[0]
    const day = Number.parseInt(dueDate.split('-')[2] || '', 10) || 1
    return {
      id: `hist-${representative.recurringPaymentId}-${dueDate}`,
      recurringPaymentId: representative.recurringPaymentId!,
      name: representative.description || 'Subscription',
      amount: active.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0),
      category: representative.category || 'Subscriptions',
      ledgerCategory: representative.ledgerCategory || representative.category || 'Subscriptions',
      dueDate,
      dueDay: day,
      isPaid: !discarded,
      isDiscarded: discarded,
      paidDate: discarded ? null : active.map(transaction => toIsoDate(transaction.date)).sort().at(-1) || null,
      status: discarded ? 'Discarded' as const : 'Paid' as const,
    }
  })

  return [...mapped, ...historical]
}

export function buildBillTimelineModel({
  activeRecurringPayments,
  allPayments,
  transactions = [],
  selectedMonth,
  selectedYear,
  cycleDay,
  cycleOffset = 0,
  fallbackDate = new Date(),
}: BuildBillTimelineModelOptions): BillTimelineModel {
  const selectedIndex = BILL_TIMELINE_MONTHS.indexOf(selectedMonth as typeof BILL_TIMELINE_MONTHS[number])
  const baseMonthIndex = selectedIndex === -1 ? fallbackDate.getMonth() : selectedIndex
  const baseYear = selectedYear > 0 ? selectedYear : fallbackDate.getFullYear()
  const totalMonths = baseMonthIndex + cycleOffset
  const monthIndex = (totalMonths % 12 + 12) % 12
  const year = baseYear + Math.floor(totalMonths / 12)
  const range = getCycleRangeDates(year, monthIndex + 1, cycleDay)
  const startTime = range.start.getTime()
  const endTime = range.end.getTime()
  const durationMs = endTime - startTime
  const startIso = formatIso(range.start)
  const endIso = formatIso(range.end)
  const rawPayments = cycleOffset === 0
    ? activeRecurringPayments
    : buildFuturePayments(allPayments, activeRecurringPayments, year, monthIndex, startIso, endIso)
  const processedPayments = applyOccurrenceStatuses(rawPayments, transactions, cycleOffset, startIso, endIso)
  const grouped = new Map<string, ActiveRecurringPayment[]>()
  for (const payment of processedPayments) {
    const group = grouped.get(payment.dueDate)
    if (group) group.push(payment)
    else grouped.set(payment.dueDate, [payment])
  }
  const timelineNodes = [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([dueDate, bills]): BillTimelineNode => {
      // `new Date('2026-08-05')` is parsed as UTC midnight while the cycle bounds are local
      // midnight, which slid every node along the rail by the local UTC offset.
      const time = parseBillTimelineDate(dueDate).getTime()
      const percent = durationMs > 0 ? Math.max(0, Math.min(100, ((time - startTime) / durationMs) * 100)) : 0
      return { dueDate, percent, bills }
    })

  const displayAmounts = processedPayments.map(getBillTimelineAmount)

  return {
    startTime,
    endTime,
    durationMs,
    startLabel: `${BILL_TIMELINE_MONTHS[range.start.getMonth()]} ${range.start.getDate()}${ordinalSuffix(range.start.getDate())}`,
    endLabel: `${BILL_TIMELINE_MONTHS[range.end.getMonth()]} ${range.end.getDate()}${ordinalSuffix(range.end.getDate())}`,
    processedPayments,
    cycleTotal: displayAmounts.some(amount => amount == null)
      ? null
      : displayAmounts.reduce<number>((total, amount) => total + (amount ?? 0), 0),
    timelineNodes,
  }
}
