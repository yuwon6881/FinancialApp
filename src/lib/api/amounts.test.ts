import { describe, expect, it } from 'vitest'
import { deobfuscateAmount, obfuscateAmount } from './amounts'

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
