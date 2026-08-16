/**
 * Rounds a finite number to the requested decimal scale using the same
 * half-away-from-zero rule as the API's decimal money calculations.
 *
 * toFixed first removes binary representation noise around familiar decimal
 * inputs such as 10.075; the integer step then makes the midpoint decision
 * explicit instead of relying on Math.round's signed behavior.
 */
export function roundMoney(value: number, scale = 2): number {
  if (!Number.isFinite(value) || !Number.isInteger(scale) || scale < 0 || scale > 12) return value
  const factor = 10 ** scale
  const fixed = Math.abs(value).toFixed(12)
  const [whole, fraction = ''] = fixed.split('.')
  const kept = fraction.slice(0, scale).padEnd(scale, '0')
  let units = BigInt(whole) * BigInt(factor) + BigInt(kept || '0')
  if ((fraction[scale] ?? '0') >= '5') units += 1n
  return Math.sign(value) * Number(units) / factor
}
