import React, { useEffect, useState } from 'react'
import { useSpring } from 'framer-motion'

interface AnimatedNumberProps {
  value: number
  className?: string
  formatFn?: (val: number) => string
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ 
  value, 
  className,
  formatFn = (v) => v.toFixed(2)
}) => {
  const [displayValue, setDisplayValue] = useState(formatFn(value))
  const springValue = useSpring(value, {
    stiffness: 100,
    damping: 20,
    mass: 1
  })

  useEffect(() => {
    springValue.set(value)
  }, [value, springValue])

  useEffect(() => {
    // Re-render immediately with the current value whenever the formatter changes
    // (e.g. a currency switch). The spring only emits 'change' when `value` moves,
    // so without this the number would keep its stale format until it next changes.
    setDisplayValue(formatFn(springValue.get()))
    const unsubscribe = springValue.on('change', (latest: number) => {
      setDisplayValue(formatFn(latest))
    })
    return () => unsubscribe()
  }, [springValue, formatFn])

  return (
    <span className={className}>
      {displayValue}
    </span>
  )
}
