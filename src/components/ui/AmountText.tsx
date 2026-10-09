import { useCallback, useEffect, useInsertionEffect, useLayoutEffect, useRef } from 'react'
import { useReducedMotion, useSpring } from 'framer-motion'
import { cn } from '../../lib/utils'
import { formatAmountParts } from '../../lib/amountFormat'
import { SensitiveMask } from './SensitiveAmount'

export interface AmountTextProps {
  value: number
  currency?: string
  /** Renders the shared sensitive-mode mask instead of the figure. */
  isMasked?: boolean
  /**
   * `auto` writes a minus for negatives only; `always` also writes a plus for positives (an
   * inflow row); `never` drops the sign because the context -- a "Spent" column, an outflow row
   * styled as outflow -- already says it.
   */
  signDisplay?: 'auto' | 'always' | 'never'
  /**
   * `positive` colours a positive figure green, the one place colour encodes direction. Outflow
   * stays ink: in Lumen, spending is normal and red is reserved for "over".
   */
  tone?: 'neutral' | 'positive' | 'muted'
  /** Counts to a new value instead of swapping it. Use on hero figures only. */
  animate?: boolean
  className?: string
  /** Accessible text when the visible figure is part of a larger sentence. */
  'aria-label'?: string
}

/**
 * Money, set the Lumen way: the whole units carry the weight, the currency marker and the cents
 * sit smaller and quieter beside them, and every digit is tabular so columns and tickers never
 * jitter. Size and weight come from the caller's type role (`text-hero`, `text-section`, ...);
 * the marker and fraction scale relative to it.
 */
export function AmountText({
  value,
  currency = 'MYR',
  isMasked = false,
  signDisplay = 'auto',
  tone = 'neutral',
  animate = false,
  className,
  'aria-label': ariaLabel,
}: AmountTextProps) {
  if (isMasked) return <SensitiveMask className={className} />
  const positive = tone === 'positive' && value > 0
  const classes = cn(
    'amount-text inline-flex items-baseline whitespace-nowrap tabular-nums',
    positive && 'text-emerald-600 dark:text-emerald-400',
    tone === 'muted' && 'text-muted-foreground',
    className,
  )
  return animate
    ? <AnimatedAmount value={value} currency={currency} signDisplay={signDisplay} className={classes} ariaLabel={ariaLabel} />
    : <StaticAmount value={value} currency={currency} signDisplay={signDisplay} className={classes} ariaLabel={ariaLabel} />
}

interface InnerProps {
  value: number
  currency: string
  signDisplay: 'auto' | 'always' | 'never'
  className: string
  ariaLabel?: string
}

function StaticAmount({ value, currency, signDisplay, className, ariaLabel }: InnerProps) {
  const parts = formatAmountParts(value, currency, signDisplay)
  const sign = parts.sign === '-' ? '−' : parts.sign
  return (
    <span className={className} aria-label={ariaLabel}>
      {sign && <span className="amount-sign">{sign}</span>}
      {!parts.currencyAfter && parts.currency && <span className="amount-currency">{parts.currency}</span>}
      <span>{parts.integer}</span>
      {parts.fraction && <span className="amount-fraction">{parts.fraction}</span>}
      {parts.currencyAfter && parts.currency && <span className="amount-currency amount-currency-after">{parts.currency}</span>}
    </span>
  )
}

/**
 * The ticking variant. Like `AnimatedNumber`, it writes straight to the text nodes on each spring
 * frame so a counting balance never re-renders through React; the structure (marker, units,
 * fraction) is rendered once and only the digits move.
 */
function AnimatedAmount({ value, currency, signDisplay, className, ariaLabel }: InnerProps) {
  const reduceMotion = useReducedMotion()
  const spring = useSpring(value, { stiffness: 90, damping: 20, mass: 1 })
  const signRef = useRef<HTMLSpanElement>(null)
  const currencyRef = useRef<HTMLSpanElement>(null)
  const integerRef = useRef<HTMLSpanElement>(null)
  const fractionRef = useRef<HTMLSpanElement>(null)
  const settings = useRef({ currency, signDisplay })
  useInsertionEffect(() => {
    settings.current = { currency, signDisplay }
  }, [currency, signDisplay])

  const write = useCallback((latest: number) => {
    const parts = formatAmountParts(latest, settings.current.currency, settings.current.signDisplay)
    if (signRef.current) signRef.current.textContent = parts.sign === '-' ? '−' : parts.sign
    if (currencyRef.current) currencyRef.current.textContent = parts.currency
    if (integerRef.current) integerRef.current.textContent = parts.integer
    if (fractionRef.current) fractionRef.current.textContent = parts.fraction
  }, [])

  useLayoutEffect(() => {
    write(reduceMotion ? value : spring.get())
  })

  useEffect(() => {
    if (reduceMotion) {
      spring.jump(value)
      write(value)
      return
    }
    spring.set(value)
  }, [value, reduceMotion, spring, write])

  useEffect(() => {
    if (reduceMotion) return
    return spring.on('change', write)
  }, [spring, reduceMotion, write])

  const final = formatAmountParts(value, currency, signDisplay)
  return (
    <span className={className} aria-label={ariaLabel ?? `${final.sign}${final.currency} ${final.integer}${final.fraction}`}>
      <span aria-hidden="true" className="contents">
        <span ref={signRef} className="amount-sign" />
        <span ref={currencyRef} className="amount-currency" />
        <span ref={integerRef} />
        <span ref={fractionRef} className="amount-fraction" />
      </span>
    </span>
  )
}
