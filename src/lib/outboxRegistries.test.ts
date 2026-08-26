import { describe, expect, it, vi } from 'vitest'
import {
  ENTITY_LABELS,
  sanitizeQueuedOps,
  WELL_FORMED_ENTITY_KINDS,
  type EntityKind,
  type OpType,
} from './outbox'

// Registry tests only inspect the dispatch keys. Keep the API barrel out of this test's module
// graph so a missing handler is the failure, rather than an unrelated API implementation detail.
vi.mock('./api', () => ({}))

import { DISPATCH } from './outboxDispatch'
import { SERVER_ASSIGNED_ID_ENTITIES } from './outboxSync'
import { QUEUED_MUTATION_POLICIES } from './mutationPolicy'

const dispatchEntries = Object.keys(DISPATCH).map(key => {
  const [entity, type] = key.split(':')
  return { key, entity: entity as EntityKind, type: type as OpType }
})

function validOp(entity: EntityKind, type: OpType) {
  return {
    id: `registry-${entity}-${type}`,
    entity,
    type,
    targetId: 'target-1',
    createdAt: 1,
    retryCount: 0,
  }
}

describe('outbox registry contracts', () => {
  it('keeps dispatch, labels, and well-formed-op acceptance in lockstep', () => {
    const dispatchEntities = new Set(dispatchEntries.map(entry => entry.entity))
    const labelledEntities = new Set(Object.keys(ENTITY_LABELS))
    const wellFormedEntities = new Set(WELL_FORMED_ENTITY_KINDS)

    expect(dispatchEntities).toEqual(labelledEntities)
    expect(labelledEntities).toEqual(wellFormedEntities)

    for (const { key, entity, type } of dispatchEntries) {
      expect(ENTITY_LABELS[entity], `${key} must have an entity label`).toBeTruthy()
      expect(typeof DISPATCH[key], `${key} must have a dispatch handler`).toBe('function')
      expect(sanitizeQueuedOps([validOp(entity, type)]), `${key} must be accepted as well formed`).toHaveLength(1)
    }
  })

  it('keeps server-assigned ids limited to server-minted entity kinds', () => {
    expect([...SERVER_ASSIGNED_ID_ENTITIES].sort()).toEqual([
      'savingsGoal',
      'taxReliefCategory',
      'wishlistItem',
    ])

    for (const entity of SERVER_ASSIGNED_ID_ENTITIES) {
      expect(typeof DISPATCH[`${entity}:add`], `${entity} must have an add handler`).toBe('function')
    }

    for (const entity of [
      'transaction',
      'investmentAccount',
      'investmentInstrument',
      'investmentActivity',
      'investmentCashFlow',
      'investmentPlan',
      'investmentAllocation',
      'investmentAllocationOrder',
      'category',
      'loan',
    ] as EntityKind[]) {
      expect(SERVER_ASSIGNED_ID_ENTITIES.has(entity), `${entity} ids are client-authored`).toBe(false)
    }
  })

  it('does not accept a queue record whose entity or operation has no registry contract', () => {
    expect(sanitizeQueuedOps([
      validOp('transaction', 'not-a-real-operation' as OpType),
      validOp('not-a-real-entity' as EntityKind, 'add'),
    ])).toEqual([])
  })

  it('requires an explicit mutation policy for every queued dispatcher', () => {
    expect(Object.keys(QUEUED_MUTATION_POLICIES).sort()).toEqual(Object.keys(DISPATCH).sort())
    for (const [key, policy] of Object.entries(QUEUED_MUTATION_POLICIES)) {
      expect(policy.projection, `${key} needs projection policy`).toBeTruthy()
      expect(policy.retry, `${key} needs retry policy`).toBeTruthy()
      expect(policy.toast, `${key} needs toast policy`).toBeTruthy()
      if (policy.undo === 'exempt') expect(policy.undoExemption, `${key} needs an Undo exemption reason`).toBeTruthy()
    }
  })
})
