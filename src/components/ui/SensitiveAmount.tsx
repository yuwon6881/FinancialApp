import React from 'react'
import { m, AnimatePresence } from 'framer-motion'
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
  return (
    <AnimatePresence mode="wait">
      {isMasked ? (
        <m.span
          key="masked"
          initial={{ opacity: 0.4, filter: 'blur(4px)', scale: 0.98 }}
          animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
          exit={{ opacity: 0.4, filter: 'blur(4px)', scale: 0.98 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          role="img"
          aria-label="Sensitive amount hidden"
          title="Sensitive amount hidden"
          className={`font-mono font-semibold tabular-nums tracking-wide select-none ${className}`}
        >
          <span aria-hidden="true">{mask}</span>
        </m.span>
      ) : (
        <m.span
          key="unmasked"
          initial={{ opacity: 0.4, filter: 'blur(4px)', scale: 0.98 }}
          animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
          exit={{ opacity: 0.4, filter: 'blur(4px)', scale: 0.98 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={`tabular-nums ${className}`}
        >
          <AnimatedNumber value={value} formatFn={formatFn} />
        </m.span>
      )}
    </AnimatePresence>
  )
}
