import { describe, it, expect, vi } from 'vitest'

// Every API module the dispatch registry can reach, eager or dynamically imported, is replaced by a
// recorder that captures the arguments each handler forwards. The point is to inspect request
// bodies for the whole registry at once rather than entry by entry -- per-entry assertions are what
// let `undoSnapshot` drift onto the wire for the investment updates in the first place.
const recorder = vi.hoisted(() => {
  const calls: { fn: string, args: unknown[] }[] = []
  const makeModule = () => new Proxy({} as Record<string, unknown>, {
    get: (_target, prop: string) => {
      if (prop === '__esModule') return true
      if (prop === 'default') return undefined
      if (prop === 'then') return undefined
      return (...args: unknown[]) => {
        calls.push({ fn: prop, args })
        // Shaped to satisfy the handlers that read an id off the result.
        return Promise.resolve({ id: 1 })
      }
    },
    has: () => true,
    ownKeys: () => [],
    getOwnPropertyDescriptor: () => ({ configurable: true, enumerable: true, value: undefined }),
  })
  return { calls, makeModule }
})

vi.mock('./api', () => recorder.makeModule())
vi.mock('./api/transactionBulk', () => recorder.makeModule())
vi.mock('./api/savingsGoals', () => recorder.makeModule())
vi.mock('./api/loans', () => recorder.makeModule())
vi.mock('./api/accounts', () => recorder.makeModule())
vi.mock('./api/documents', () => recorder.makeModule())

import { DISPATCH } from './outboxDispatch'
import type { QueuedOp } from './outbox'

const findDeep = (value: unknown, key: string, seen = new Set<unknown>()): boolean => {
  if (value === null || typeof value !== 'object') return false
  if (seen.has(value)) return false
  seen.add(value)
  if (Array.isArray(value)) return value.some(entry => findDeep(entry, key, seen))
  if (Object.prototype.hasOwnProperty.call(value, key)) return true
  return Object.values(value).some(entry => findDeep(entry, key, seen))
}

// A snapshot-bearing payload wide enough that every handler finds the fields it reads. The nested
// `undoSnapshot` is a full record copy, which is what the real enqueue sites persist.
const makeOp = (key: string): QueuedOp => {
  const [entity, type] = key.split(':')
  return {
    id: `op-${key}`,
    entity: entity as QueuedOp['entity'],
    type: type as QueuedOp['type'],
    targetId: 'target-1',
    timestamp: 0,
    retryCount: 0,
    payload: {
      id: 'target-1',
      name: 'Example',
      description: 'Example',
      amount: -25,
      price: 25,
      openingPrincipal: 1000,
      limit: 500,
      taxYear: 2026,
      date: '2026-08-01',
      active: true,
      transactions: [],
      instrumentIds: [],
      sleeve: 'Core',
      undoSnapshot: { id: 'target-1', name: 'Before', amount: -25, price: 25, openingPrincipal: 1000 },
    },
  } as unknown as QueuedOp
}

describe('dispatch never puts undoSnapshot on the wire', () => {
  it.each(Object.keys(DISPATCH))('%s', async (key) => {
    recorder.calls.length = 0
    // Handlers may reject on the recorder's stand-in results; only the forwarded body matters here.
    await DISPATCH[key](makeOp(key)).catch(() => undefined)

    expect(recorder.calls.length, `${key} forwarded nothing to the API layer`).toBeGreaterThan(0)
    for (const call of recorder.calls) {
      expect(findDeep(call.args, 'undoSnapshot'), `${key} -> ${call.fn} carried undoSnapshot`).toBe(false)
    }
  })
})
