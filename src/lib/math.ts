// Evaluates a basic arithmetic expression (+ - * / and parentheses) with a
// hand-rolled recursive-descent parser. The production build ships a CSP
// without 'unsafe-eval' (see cspMetaPlugin in vite.config.ts), so `eval` /
// `new Function` throw at runtime in the deployed PWA and the Capacitor
// webview — evaluation must not rely on them.
//
// Returns null (never throws) for anything that isn't a complete, valid
// expression — e.g. a trailing operator ("12.00+"), unbalanced parentheses,
// or division by zero — so callers can safely leave the input untouched.
export const evaluateMathString = (input: string): number | null => {
  // Accept both the intended calculator glyphs and their legacy mojibake
  // forms, then strip everything outside the allowed alphabet.
  const sanitized = input
    .replace(/×|Ã—/g, '*')
    .replace(/÷|Ã·/g, '/')
    .replace(/−/g, '-')
    .replace(/[^0-9+\-*/().]/g, '')
  if (!sanitized) return null

  let pos = 0

  const parseExpression = (): number => {
    let value = parseTerm()
    while (sanitized[pos] === '+' || sanitized[pos] === '-') {
      const op = sanitized[pos++]
      const rhs = parseTerm()
      value = op === '+' ? value + rhs : value - rhs
    }
    return value
  }

  const parseTerm = (): number => {
    let value = parseFactor()
    while (sanitized[pos] === '*' || sanitized[pos] === '/') {
      const op = sanitized[pos++]
      const rhs = parseFactor()
      value = op === '*' ? value * rhs : value / rhs
    }
    return value
  }

  const parseFactor = (): number => {
    if (sanitized[pos] === '+' || sanitized[pos] === '-') {
      const op = sanitized[pos++]
      const value = parseFactor()
      return op === '-' ? -value : value
    }
    if (sanitized[pos] === '(') {
      pos++
      const value = parseExpression()
      if (sanitized[pos] !== ')') throw new Error('unbalanced parenthesis')
      pos++
      return value
    }
    const start = pos
    while (pos < sanitized.length && /[0-9.]/.test(sanitized[pos])) pos++
    const literal = sanitized.slice(start, pos)
    // Rejects a missing operand ("12+") and malformed literals ("1.2.3").
    if (!/^(\d+(\.\d*)?|\.\d+)$/.test(literal)) throw new Error('invalid number')
    return parseFloat(literal)
  }

  try {
    const result = parseExpression()
    // Unconsumed input means the expression was malformed, e.g. "1)2".
    if (pos !== sanitized.length) return null
    if (!Number.isFinite(result)) return null
    // Return rounded to 2 decimal places max, avoiding floating point chaos
    return Math.round(result * 100) / 100
  } catch {
    return null
  }
}
