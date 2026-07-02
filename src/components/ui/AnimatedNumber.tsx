import React, { useEffect, useRef, useState } from 'react'

interface AnimatedNumberProps {
  value: number
  format: (n: number) => string
  /** When hidden, render the (blurred) value with no animation. */
  hideSensitive?: boolean
  durationMs?: number
  className?: string
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Smoothly counts from the previous value to the new one (easeOutCubic).
 * Relies on tabular-lining numerals (set globally in index.css) so the digits
 * don't shift horizontally while animating. Skips the tween when the figure is
 * blurred/hidden or the user prefers reduced motion.
 */
export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  format,
  hideSensitive,
  durationMs = 650,
  className,
}) => {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const rafRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (hideSensitive || prefersReducedMotion()) {
      setDisplay(value)
      fromRef.current = value
      return
    }
    const from = fromRef.current
    if (from === value) return

    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(from + (value - from) * eased)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        fromRef.current = value
      }
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [value, hideSensitive, durationMs])

  if (hideSensitive) {
    return (
      <span className="blur-sm select-none pointer-events-none inline-block transition-[filter] duration-200">
        {format(value)}
      </span>
    )
  }

  return <span className={className}>{format(display)}</span>
}
