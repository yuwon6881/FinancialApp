export const evaluateMathString = (input: string): number | null => {
  try {
    // Accept both the intended calculator glyphs and their legacy mojibake forms.
    input = input
      .replace(/\u00d7|\u00c3\u2014/g, '*')
      .replace(/\u00f7|\u00c3\u00b7/g, '/')
    // Replace nice symbols back to standard ones for JS evaluation
    let sanitized = input.replace(/×/g, '*').replace(/÷/g, '/')
    
    // Aggressively sanitize input to only allow numbers, dots, and basic math operators
    sanitized = sanitized.replace(/[^0-9+\-*/().\s]/g, '')
    if (!sanitized.trim()) return null
    
    // Safely evaluate using new Function with heavily restricted alphabet
    const result = new Function(`return ${sanitized}`)()
    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      // Return rounded to 2 decimal places max, avoiding floating point chaos
      return Math.round(result * 100) / 100
    }
    return null
  } catch {
    return null
  }
}
