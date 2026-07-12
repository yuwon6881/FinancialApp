import React, { type InputHTMLAttributes, useEffect, useRef, useState } from 'react'
import { evaluateMathString } from '../../lib/math'

export const SmartAmountInput = React.forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>((props, forwardedRef) => {
  const { className, onChange, onKeyDown, onFocus, onBlur, value, ...inputProps } = props
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [focused, setFocused] = useState(false)
  const [inputWidth, setInputWidth] = useState(0)

  const setRef = (node: HTMLInputElement | null) => {
    inputRef.current = node
    if (typeof forwardedRef === 'function') forwardedRef(node)
    else if (forwardedRef) forwardedRef.current = node
  }

  // Measure the input's rendered width so the calculator toolbar only appears
  // when there is genuinely room for it. On a narrow field (e.g. a half-width
  // grid cell) the absolutely-positioned toolbar would otherwise cover the
  // digits entirely, so we hide it below a usable threshold.
  useEffect(() => {
    const node = inputRef.current
    if (!node) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) setInputWidth(entry.target.getBoundingClientRect().width)
    })
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

  // Only surface the calculator toolbar on a comfortably wide field. Below this
  // the ~150px toolbar would cover most of the input, so we hide it and let the
  // field behave as a plain amount entry (math via the =/Enter key still works).
  const allowCalculator = inputWidth >= 260

  const publishValue = (nextValue: string) => {
    const input = inputRef.current
    if (!input) return
    // Set the value through the prototype setter, then dispatch a real `input`
    // event so React's own onChange pipeline runs (and any currency mask the
    // consumer applies re-runs). Hand-calling the onChange prop with a fabricated
    // event object did not reliably update the controlled value.
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, nextValue)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }

  const evaluate = () => {
    const expression = inputRef.current?.value.trim() ?? ''
    if (!expression) return
    const result = evaluateMathString(expression)
    // Publish a fixed 2-decimal string ("12.30", not "12.3"). Consumers that
    // re-run the value through a currency mask (the ledger amount field) treat
    // digits as cents, so a dropped trailing zero would be re-parsed as a
    // different number ("12.3" -> "1.23"). Keeping exactly two decimals is
    // stable through that round-trip and correct for plain consumers too.
    if (result !== null) publishValue(result.toFixed(2))
  }

  const appendOperator = (operator: string) => {
    const current = inputRef.current?.value ?? ''
    if (!current) return
    const next = /[+\-×÷*/]$/.test(current)
      ? `${current.slice(0, -1)}${operator}`
      : `${current}${operator}`
    publishValue(next)
  }

  const showCalculator = focused && allowCalculator

  return (
    <div className="relative w-full">
      <input
        {...inputProps}
        ref={setRef}
        value={value}
        type="text"
        inputMode="decimal"
        className={`${className ?? ''} text-left transition-all duration-200 ${showCalculator ? 'pr-36' : ''}`}
        onChange={event => {
          if (/^-?[0-9.()+\-*/×÷\s]*$/.test(event.target.value)) onChange?.(event)
        }}
        onFocus={event => { setFocused(true); onFocus?.(event) }}
        onBlur={event => {
          // Resolve any pending expression (e.g. "12.00×5.00") when leaving the
          // field, matching the =/Enter behaviour.
          evaluate()
          setFocused(false)
          onBlur?.(event)
        }}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === '=') {
            event.preventDefault()
            evaluate()
          }
          onKeyDown?.(event)
        }}
      />

      {showCalculator && (
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex overflow-hidden rounded-lg border border-border/80 bg-card/95 shadow-sm">
          {[
            ['+', '+'],
            ['−', '-'],
            ['×', '×'],
            ['÷', '÷'],
          ].map(([label, operator]) => (
            <button
              key={operator}
              type="button"
              onMouseDown={event => { event.preventDefault(); appendOperator(operator) }}
              className="border-r border-border/50 px-2 py-1.5 text-xs font-semibold hover:bg-muted/80"
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onMouseDown={event => { event.preventDefault(); evaluate() }}
            className="bg-blue-500/10 px-2.5 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-500/20"
          >
            =
          </button>
        </div>
      )}
    </div>
  )
})

SmartAmountInput.displayName = 'SmartAmountInput'
