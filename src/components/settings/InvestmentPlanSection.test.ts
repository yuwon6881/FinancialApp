import { describe, expect, it } from 'vitest'
import { addInvestmentGroup, changeGroupTarget, currentGroupMix, getInvestmentGroups, removeInvestmentGroup, weightedGroupTargets } from '../../lib/investmentGroups'

const groups = getInvestmentGroups({ usEquityTarget: 66, internationalExUsTarget: 10, bondsTarget: 24, watchDrift: 3, alertDrift: 5 })
const weights = (values: typeof groups) => values.map(group => group.targetPercentage)

describe('portfolio group target redistribution', () => {
  it('keeps all the targets positive and the total at 100', () => {
    expect(weights(changeGroupTarget(groups, 'USEquity', 75))).toEqual([75, 7, 18])
    expect(weights(changeGroupTarget(groups, 'Bonds', 100))).toEqual([1, 1, 98])
    expect(weights(changeGroupTarget(groups, 'USEquity', 75, 'InternationalExUS'))).toEqual([75, 10, 15])
  })

  it('reallocates a removed group and leaves a sole group at 100%', () => {
    const two = removeInvestmentGroup(groups, 'InternationalExUS')
    expect(weights(two)).toEqual([73, 27])
    expect(weights(removeInvestmentGroup(two, 'USEquity'))).toEqual([100])
  })
})

describe('default portfolio targets', () => {
  it('splits evenly without prices and follows what is held when it can', () => {
    expect(weights(weightedGroupTargets(groups))).toEqual([34, 33, 33])
    expect(weights(weightedGroupTargets(groups, new Map([['USEquity', 700], ['InternationalExUS', 100], ['Bonds', 200]])))).toEqual([70, 10, 20])
    // A group that holds nothing yet still gets the smallest share rather than zero.
    expect(weights(weightedGroupTargets(groups, new Map([['USEquity', 1000], ['InternationalExUS', 0], ['Bonds', 0]])))).toEqual([98, 1, 1])
  })

  it('reports a current mix only when every group value is known', () => {
    const sleeves = [{ sleeve: 'USEquity', value: 50 }, { sleeve: 'InternationalExUS', value: 50 }, { sleeve: 'Bonds', value: undefined }]
    expect(currentGroupMix(groups, sleeves)).toBeUndefined()
    expect(currentGroupMix(groups.slice(0, 2), sleeves)).toEqual(new Map([['USEquity', 50], ['InternationalExUS', 50]]))
  })

  it('starts a replacement group at 100% when targets are still enabled', () => {
    expect(weights(addInvestmentGroup([], 'Property', true))).toEqual([100])
  })

  it('leaves shares alone while targets are off and adds new groups at zero', () => {
    const off = groups.map(group => ({ ...group, targetPercentage: 0 }))
    expect(weights(removeInvestmentGroup(off, 'Bonds'))).toEqual([0, 0])
    expect(weights(addInvestmentGroup(off, 'Property', false))).toEqual([0, 0, 0, 0])
    expect(weights(addInvestmentGroup(groups, 'Property', true))).toEqual([63, 9, 23, 5])
  })
})
