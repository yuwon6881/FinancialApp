import { describe, expect, it } from 'vitest'
import { bucketAmount, netBucketAmount } from './bucketAttribution'

const tx = (ledgerCategory: string, amount: number) => ({ ledgerCategory, amount })

describe('bucketAttribution', () => {
  it('reads a bucket-named row at its own amount', () => {
    expect(bucketAmount(tx('Stability', -120), 'Stability')).toBe(-120)
    expect(bucketAmount(tx('Stability', -120), 'Growth')).toBe(0)
  })

  it('takes a split percentage of an income row rather than its whole amount', () => {
    // The salary's effect on Stability is 15% of it, not the 4,000 the ledger shows on the row.
    expect(bucketAmount(tx('IncomeSplit:50,25,15,10', 4000), 'Stability')).toBe(600)
    expect(bucketAmount(tx('IncomeSplit:50,25,15,10', 4000), 'Essentials')).toBe(2000)
  })

  it('signs a transfer by direction, not by the sign of its amount', () => {
    expect(bucketAmount(tx('Transfer:Stability->Essentials', 300), 'Stability')).toBe(-300)
    expect(bucketAmount(tx('Transfer:Stability->Essentials', 300), 'Essentials')).toBe(300)
    expect(bucketAmount(tx('Transfer:Income->Stability', 600), 'Stability')).toBe(600)
    expect(bucketAmount(tx('Transfer:Income->Stability', 600), 'Growth')).toBe(0)
  })

  it('ignores a malformed spec instead of guessing at it', () => {
    expect(bucketAmount(tx('IncomeSplit:50,25,15', 4000), 'Stability')).toBe(0)
    expect(bucketAmount(tx('Transfer:Stability', 300), 'Stability')).toBe(0)
    expect(bucketAmount(tx('', 300), 'Stability')).toBe(0)
  })

  it('nets a drawdown window to the amount the fund is short', () => {
    // 600 in from a salary, 900 straight back out: the fund is 300 down over the window, which is
    // the figure the emergency-fund card asks to be put back. Summing raw amounts would say +1,500.
    const rows = [
      tx('Transfer:Income->Stability', 600),
      tx('Transfer:Stability->Essentials', 500),
      tx('Stability', -400),
    ]
    expect(netBucketAmount(rows, 'Stability')).toBe(-300)
  })

  it('rounds a repeating split share to cents', () => {
    expect(netBucketAmount([tx('IncomeSplit:33.3333,33.3333,33.3334,0', 100)], 'Stability')).toBe(33.33)
  })
})
