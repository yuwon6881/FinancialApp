export const evaluateMathString = (input: string): number | null => {
  try {
    // Aggressively sanitize input to only allow numbers, dots, and basic math operators
    const sanitized = input.replace(/[^0-9+\-*/().\s]/g, '')
    if (!sanitized.trim()) return null
    
    // Safely evaluate using new Function with heavily restricted alphabet
    const result = new Function(`return ${sanitized}`)()
    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      // Return rounded to 2 decimal places max, avoiding floating point chaos
      return Math.round(result * 100) / 100
    }
    return null
  } catch (e) {
    return null
  }
}
