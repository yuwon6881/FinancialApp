import { describe, expect, it } from 'vitest'
import { evaluateMathString } from './math'

describe('evaluateMathString', () => {
  it('evaluates calculator multiplication and division glyphs', () => {
    expect(evaluateMathString('12×3')).toBe(36)
    expect(evaluateMathString('12÷3')).toBe(4)
  })

  it('evaluates the legacy mojibake glyphs emitted by older bundles', () => {
    expect(evaluateMathString(`12${'Ã—'}3`)).toBe(36)
    expect(evaluateMathString(`12${'Ã·'}3`)).toBe(4)
  })

  it('does not rely on eval/Function, which the production CSP blocks', () => {
    // The deployed app ships `script-src 'self'` without 'unsafe-eval'
    // (vite.config.ts), so `new Function` throws at runtime. Simulate that
    // here: evaluation must still succeed.
    const originalFunction = globalThis.Function
    globalThis.Function = (() => {
      throw new EvalError('blocked by Content-Security-Policy')
    }) as never
    try {
      expect(evaluateMathString('12.00×5.00')).toBe(60)
    } finally {
      globalThis.Function = originalFunction
    }
  })

  it('honours operator precedence and parentheses', () => {
    expect(evaluateMathString('2+3×4')).toBe(14)
    expect(evaluateMathString('(2+3)×4')).toBe(20)
    expect(evaluateMathString('10-2-3')).toBe(5)
    expect(evaluateMathString('20÷2÷2')).toBe(5)
  })

  it('handles decimals, unary minus and rounds to 2 decimal places', () => {
    expect(evaluateMathString('12.50+0.25')).toBe(12.75)
    expect(evaluateMathString('-5+8')).toBe(3)
    expect(evaluateMathString('10÷3')).toBe(3.33)
    expect(evaluateMathString('0.1+0.2')).toBe(0.3)
  })

  it('returns null for incomplete or invalid expressions', () => {
    expect(evaluateMathString('12.00+')).toBeNull()
    expect(evaluateMathString('×5')).toBeNull()
    expect(evaluateMathString('(2+3')).toBeNull()
    expect(evaluateMathString('1.2.3')).toBeNull()
    expect(evaluateMathString('')).toBeNull()
    expect(evaluateMathString('abc')).toBeNull()
  })

  it('returns null for division by zero', () => {
    expect(evaluateMathString('5÷0')).toBeNull()
  })
})
