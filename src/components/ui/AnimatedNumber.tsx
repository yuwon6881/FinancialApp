import React, { useCallback, useEffect, useInsertionEffect, useLayoutEffect, useRef } from 'react'
import { useSpring, useReducedMotion } from 'framer-motion'

interface AnimatedNumberProps {
  value: number
  className?: string
  formatFn?: (val: number) => string
}

/**
 * Counts a number up/down to `value` by writing straight to the DOM text node.
 *
 * The previous implementation held the spring's latest output in React state, so every
 * animation frame triggered a full render + commit of this component — and the dashboard
 * mounts many of these at once (every SensitiveAmount), all springing simultaneously
 * after a cycle switch. Frames now cost one `textContent` assignment each and never
 * enter the React render path.
 *
 * Because the value is not part of the rendered output, the span is deliberately empty in
 * JSX: if React owned the text it would re-commit the final value on any parent render and
 * cut the animation short. A layout effect paints synchronously before the browser draws,
 * so there is no empty first frame.
 */
export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  className,
  formatFn = (v) => v.toFixed(2)
}) => {
  const nodeRef = useRef<HTMLSpanElement>(null)
  const reduceMotion = useReducedMotion()
  const springValue = useSpring(value, {
    stiffness: 100,
    damping: 20,
    mass: 1
  })

  // Callers pass `formatFn` as an inline arrow, so its identity changes every render.
  // Read it through a ref to keep the spring subscription stable for the component's
  // whole lifetime instead of tearing down and re-adding a listener each render.
  const formatRef = useRef(formatFn)
  useInsertionEffect(() => {
    formatRef.current = formatFn
  }, [formatFn])

  const write = useCallback((latest: number) => {
    const node = nodeRef.current
    if (node) node.textContent = formatRef.current(latest)
  }, [])

  // Runs after every render (no dependency array) so a changed formatter — a currency
  // switch, say — reformats immediately. The spring only emits 'change' while `value` is
  // moving, so without this the number would keep its stale format until it next changed.
  // Writing the spring's *current* value rather than the target means an in-flight
  // animation is not snapped forward by an unrelated parent re-render.
  useLayoutEffect(() => {
    write(reduceMotion ? value : springValue.get())
  })

  useEffect(() => {
    if (reduceMotion) {
      // Honour prefers-reduced-motion: land on the value with no interpolation, and keep
      // the spring in sync so re-enabling motion mid-session starts from the right place.
      springValue.jump(value)
      write(value)
      return
    }
    springValue.set(value)
  }, [value, reduceMotion, springValue, write])

  useEffect(() => {
    if (reduceMotion) return
    return springValue.on('change', write)
  }, [springValue, reduceMotion, write])

  return <span ref={nodeRef} className={className} />
}
