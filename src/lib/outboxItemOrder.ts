import type { EntityKind } from './outboxTypes'

type OptimisticListItem = {
  id: string | number
  name?: string
  symbol?: string
  isArchived?: boolean
}

const compareIds = (left: OptimisticListItem, right: OptimisticListItem) =>
  String(left.id).localeCompare(String(right.id))

type OptimisticListOrderPolicy = {
  addPlacement?: 'prepend' | 'append'
  compare?: (left: OptimisticListItem, right: OptimisticListItem) => number
}

// Canonical API ordering is applied as part of projection so adds and ordering-field updates land
// where the next server refresh will put them. Some APIs expose a sortable field; others, such as
// tax relief limits, expose only database insertion order and therefore need append placement.
// Contextual view orders (ledger modes, reward priority, investment filters) stay in their helpers.
export const OPTIMISTIC_LIST_ORDER_POLICIES: Partial<Record<EntityKind, OptimisticListOrderPolicy>> = {
  category: {
    compare: (left, right) => (left.name ?? '').localeCompare(right.name ?? ''),
  },
  recurringPayment: {
    compare: (left, right) =>
      (left.name ?? '').localeCompare(right.name ?? '') || compareIds(left, right),
  },
  loan: {
    compare: (left, right) =>
      (left.name ?? '').localeCompare(right.name ?? '') || compareIds(left, right),
  },
  ledgerAccount: {
    compare: (left, right) =>
      (left as OptimisticListItem & { bucket?: string }).bucket?.localeCompare((right as OptimisticListItem & { bucket?: string }).bucket ?? '') ||
      (left.name ?? '').localeCompare(right.name ?? '') || compareIds(left, right),
  },
  investmentAccount: {
    compare: (left, right) =>
      Number(left.isArchived === true) - Number(right.isArchived === true) ||
      (left.name ?? '').localeCompare(right.name ?? '') ||
      compareIds(left, right),
  },
  investmentInstrument: {
    compare: (left, right) =>
      (left.symbol ?? '').localeCompare(right.symbol ?? '') || compareIds(left, right),
  },
  taxReliefCategory: {
    addPlacement: 'append',
  },
}
