import { describe, expect, it } from 'vitest'
import { deobfuscateActiveRecurringPayment, deobfuscateAmount, obfuscateAmount } from './amounts'
import type { WireActiveRecurringPayment } from '../apiTypes'

describe('active recurring occurrence decoding', () => {
  const wire = (overrides: Partial<WireActiveRecurringPayment> = {}): WireActiveRecurringPayment => ({
    id: 'occ1',
    recurringPaymentId: 'rp1',
    name: 'Streaming',
    amount: obfuscateAmount(15),
    category: 'Entertainment',
    ledgerCategory: 'Essentials',
    dueDate: '2026-07-10',
    isPaid: false,
    isDiscarded: false,
    status: 'Pending',
    ...overrides,
  })

  it('decodes every money field so bill figures never reach the UI as NaN', () => {
    const decoded = deobfuscateActiveRecurringPayment(wire({
      status: 'PartiallyPaid',
      amount: obfuscateAmount(9),
      scheduledAmount: obfuscateAmount(15),
      paidAmount: obfuscateAmount(6),
      remainingAmount: obfuscateAmount(9),
    }))

    expect(decoded.amount).toBe(9)
    expect(decoded.scheduledAmount).toBe(15)
    expect(decoded.paidAmount).toBe(6)
    expect(decoded.remainingAmount).toBe(9)
  })

  it('keeps absent optional amounts absent so `??` fallbacks still reach amount', () => {
    const decoded = deobfuscateActiveRecurringPayment(wire())

    expect(decoded.amount).toBe(15)
    expect(decoded.paidAmount).toBeUndefined()
    expect(decoded.remainingAmount).toBeUndefined()
    expect(decoded.remainingAmount ?? decoded.amount).toBe(15)
  })

  it('preserves a null scheduled amount instead of turning unknown into zero', () => {
    const decoded = deobfuscateActiveRecurringPayment(wire({ amount: null, scheduledAmount: null }))

    expect(decoded.amount).toBeNull()
    expect(decoded.scheduledAmount).toBeNull()
  })
})

describe('amount wire encoding guards', () => {
  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'decodes non-finite numeric input %s as zero',
    (value) => {
      expect(deobfuscateAmount(value)).toBe(0)
    },
  )

  it('decodes an encoded NaN payload as zero', () => {
    const key = 'FinancialAppObfuscationKey'
    const input = new TextEncoder().encode('NaN')
    let binary = ''
    for (let index = 0; index < input.length; index += 1) {
      binary += String.fromCharCode(input[index] ^ key.charCodeAt(index % key.length))
    }

    expect(deobfuscateAmount(btoa(binary))).toBe(0)
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 'not-a-number'])(
    'refuses to encode invalid amount %s',
    (value) => {
      expect(() => obfuscateAmount(value)).toThrow(TypeError)
    },
  )
})
