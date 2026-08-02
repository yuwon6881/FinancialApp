import { describe, expect, it } from 'vitest'
import { buildMutationSuccessToast, buildUndoSuccessToast } from './mutationToast'

describe('mutation toast copy', () => {
  it('uses the shared entity/action title and record-first message', () => {
    expect(buildMutationSuccessToast({
      entity: 'Savings Goal',
      action: 'Rolled Forward',
      recordName: 'Car service',
      messageSuffix: 'MYR 1,200.00 was spent from Rewards and recorded in your ledger.',
    })).toEqual({
      title: 'Savings Goal Rolled Forward',
      message: '"Car service" was rolled forward. MYR 1,200.00 was spent from Rewards and recorded in your ledger.',
      tone: 'success',
    })
  })

  it('keeps reversible success copy consistent when a record is known', () => {
    expect(buildUndoSuccessToast('Car service', 'savings goal')).toEqual({
      title: 'Undo successful',
      message: 'The change to "Car service" was undone.',
      tone: 'success',
    })
  })

  it('supports batch mutations without inventing a record name', () => {
    expect(buildMutationSuccessToast({
      entity: 'Documents',
      action: 'Deleted',
      message: '3 documents were deleted.',
    })).toEqual({
      title: 'Documents Deleted',
      message: '3 documents were deleted.',
      tone: 'success',
    })
  })
})
