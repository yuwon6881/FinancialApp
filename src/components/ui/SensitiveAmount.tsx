import React from 'react'
import { AnimatedNumber } from './AnimatedNumber'
import { SENSITIVE_AMOUNT_MASK } from '../../lib/utils'

interface SensitiveAmountProps {
  value: number
  isMasked?: boolean
  mask?: string
  formatFn?: (val: number) => string
  className?: string
}

interface SensitiveMaskProps {
  mask?: string
  className?: string
}

export const SensitiveMask: React.FC<SensitiveMaskProps> = ({
  mask = SENSITIVE_AMOUNT_MASK,
  className = '',
}) => (
  <span
    role="img"
    aria-label="Sensitive amount hidden"
    title="Sensitive amount hidden"
    className={`inline-block font-mono font-semibold tabular-nums tracking-wide select-none ${className}`}
  >
    <span aria-hidden="true">{mask}</span>
  </span>
)

export const SensitiveAmount: React.FC<SensitiveAmountProps> = ({
  value,
  isMasked = false,
  mask = SENSITIVE_AMOUNT_MASK,
  formatFn,
  className = '',
}) => {
  if (isMasked) return <SensitiveMask mask={mask} className={className} />

  // Privacy state changes are atomic. The previous blur animation could remain at its initial
  // keyframe when a first render was throttled, leaving a real amount visibly blurred until the
  // route remounted. AnimatedNumber still handles ordinary value changes without masking state.
  return <span className={`tabular-nums ${className}`}><AnimatedNumber value={value} formatFn={formatFn} /></span>
}
