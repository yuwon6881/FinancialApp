import { describe, expect, it } from 'vitest'
import {
  SENSITIVE_AMOUNT_MASK,
  capitalizeWords,
  cn,
  formatCurrencyVal,
  maskCurrencyInput,
} from './utils'

describe('utils', () => {
  describe('cn', () => {
    it('merges class names and handles conditional classes cleanly', () => {
      expect(cn('px-2 py-1', true && 'bg-card', false && 'hidden')).toBe('px-2 py-1 bg-card')
      expect(cn('p-4', 'p-2')).toBe('p-2')
    })
  })

  describe('SENSITIVE_AMOUNT_MASK', () => {
    it('is six dots', () => {
      expect(SENSITIVE_AMOUNT_MASK).toBe('......')
    })
  })

  describe('capitalizeWords', () => {
    it('capitalizes the first letter of each word while preserving casing and acronyms', () => {
      expect(capitalizeWords('nasi lemak')).toBe('Nasi Lemak')
      expect(capitalizeWords('hdmi cable')).toBe('Hdmi Cable')
      expect(capitalizeWords('HDMI cable')).toBe('HDMI Cable')
      expect(capitalizeWords('bills')).toBe('Bills')
    })
  })

  describe('formatCurrencyVal', () => {
    it('formats values with appropriate currency and locale', () => {
      const myr = formatCurrencyVal(1234.56, 'MYR')
      expect(myr).toContain('1,234.56')

      const usd = formatCurrencyVal(50, 'USD')
      expect(usd).toContain('50.00')

      const rm = formatCurrencyVal(100, 'RM')
      expect(rm).toContain('100.00')
    })
  })

  describe('maskCurrencyInput', () => {
    it('returns empty string for empty input', () => {
      expect(maskCurrencyInput('', '')).toBe('')
    })

    it('applies ATM formatting to money amounts (divides integer cents by 100)', () => {
      expect(maskCurrencyInput('5', '')).toBe('0.05')
      expect(maskCurrencyInput('50', '')).toBe('0.50')
      expect(maskCurrencyInput('500', '')).toBe('5.00')
      expect(maskCurrencyInput('123456', '')).toBe('1234.56')
    })

    it('formats expressions with operators preserving arithmetic tokens', () => {
      const result = maskCurrencyInput('100+200', '')
      expect(result).toBe('1.00+2.00')
    })

    it('treats multiplication and division operands as scalar counts by default', () => {
      const mult = maskCurrencyInput('100*3', '')
      expect(mult).toBe('1.00×3')

      const div = maskCurrencyInput('500/2', '')
      expect(div).toBe('5.00÷2')
    })

    it('supports typed decimal point on scalar multiplier or divisor', () => {
      const multDecimal = maskCurrencyInput('100*1.5', '')
      expect(multDecimal).toBe('1.00×1.5')
    })

    it('preserves unary minus on divisor operand', () => {
      const unaryDiv = maskCurrencyInput('12/-2', '')
      expect(unaryDiv).toBe('0.12÷-2')
    })
  })
})
