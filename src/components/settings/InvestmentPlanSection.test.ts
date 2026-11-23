import { describe, expect, it } from 'vitest'
import { changeGroupTarget, getInvestmentGroups, removeInvestmentGroup } from '../../lib/investmentGroups'

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
