import type { IncomeAllocations } from './incomeSplitProjection'
import type { QueuedOp } from './outboxTypes'

/** Generated bucket rows share their parent's sync state; nothing dispatches them on their own. */
export const splitRowState = (op: QueuedOp) => ({
  isPendingSync: !op.isCompleted,
  pendingSyncOperationId: op.isCompleted ? undefined : op.id,
})

export interface ApplyOpsOptions {
  /**
   * The stability-plan percentages, used only to project the bucket rows the server generates
   * for a plain `Income` save (an `IncomeSplit:` row carries its own). Omitted, an income row
   * still projects itself; only its four generated siblings wait for the refresh.
   */
  incomeAllocations?: IncomeAllocations
  ledgerAccounts?: ReadonlyArray<{ id: string; bucket: string }>
  /** Inclusive visible Ledger range. Omitted callers retain the existing projection behavior. */
  transactionDateRange?: { start: string; end: string }
}

/** The shape every projected list row shares, whatever entity it belongs to. */
export interface ProjectionRow {
  id: string | number
  isPendingSync?: boolean
  isPendingDelete?: boolean
}

/**
 * The row set one projection pass mutates, plus the id index the replay looks rows up through.
 * A single pass touches the same server-generated row many times and is split across the
 * cross-entity and same-entity projection modules, so the rows and their index have to travel
 * together. The index is repaired lazily rather than rebuilt whenever the rows are replaced: a
 * structural change validates a cached entry against the current rows and re-finds it only when
 * it went stale, which keeps list ordering and every existing projection semantic unchanged.
 */
export class ProjectionRows<T extends ProjectionRow> {
  private indexes = new Map<string, number>()
  private list: T[]

  constructor(list: T[]) {
    this.list = list
    list.forEach((item, index) => this.indexes.set(String(item.id), index))
  }

  get rows(): T[] {
    return this.list
  }

  set rows(next: T[]) {
    this.list = next
  }

  findIndex(id: string | number): number {
    const key = String(id)
    const cached = this.indexes.get(key)
    if (cached !== undefined && String(this.list[cached]?.id) === key) return cached
    const index = this.list.findIndex(item => String(item.id) === key)
    if (index >= 0) this.indexes.set(key, index)
    else this.indexes.delete(key)
    return index
  }
}
