import { describe, expect, it } from 'vitest'
import { evaluateMathString } from './math'

describe('evaluateMathString', () => {
  it('evaluates calculator multiplication and division glyphs', () => {
    expect(evaluateMathString('12×3')).toBe(36)
    expect(evaluateMathString('12÷3')).toBe(4)
  })

  it('evaluates the legacy mojibake glyphs emitted by older bundles', () => {
    expect(evaluateMathString(`12${'\u00c3\u2014'}3`)).toBe(36)
    expect(evaluateMathString(`12${'\u00c3\u00b7'}3`)).toBe(4)
  })
})
