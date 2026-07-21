import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AnimatedNumber } from './AnimatedNumber'
import { SENSITIVE_AMOUNT_MASK } from '../../lib/utils'

interface SensitiveAmountProps {
  value: number
  isMasked?: boolean
  mask?: string
  formatFn?: (val: number) => string
  className?: string
}

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
        <motion.span
          key="masked"
          initial={{ opacity: 0.4, filter: 'blur(4px)', scale: 0.98 }}
          animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
          exit={{ opacity: 0.4, filter: 'blur(4px)', scale: 0.98 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={`font-mono tracking-wide ${className}`}
        >
          {mask}
        </motion.span>
      ) : (
        <motion.span
          key="unmasked"
          initial={{ opacity: 0.4, filter: 'blur(4px)', scale: 0.98 }}
          animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
          exit={{ opacity: 0.4, filter: 'blur(4px)', scale: 0.98 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={className}
        >
          <AnimatedNumber value={value} formatFn={formatFn} />
        </motion.span>
      )}
    </AnimatePresence>
  )
}
