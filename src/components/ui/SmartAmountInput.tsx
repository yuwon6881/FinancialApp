import React, { type InputHTMLAttributes, useEffect, useRef, useState } from 'react'
import { Button } from './Button'
import { evaluateMathString } from '../../lib/math'
import { Input } from './Input'

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
    // Set the DOM value, then invoke the onChange prop directly with a
    // synthetic-shaped event. We deliberately do NOT dispatch a native `input`
    // event: this field is rendered inside a modal that is portaled to
    // document.body, so a native event bubbles to body and never reaches
    // React's delegated listener on the app root -- onChange would silently
    // never fire (breaking the = button and blur evaluation). Calling the prop
    // directly is portal-safe. The consumer re-runs its currency mask on the
    // value we pass, so keeping exactly two decimals (see evaluate) is required.
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, nextValue)
    onChange?.({ target: input, currentTarget: input } as React.ChangeEvent<HTMLInputElement>)
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

  const isReadOnly = Boolean(inputProps.readOnly || inputProps.disabled)
  const showCalculator = focused && allowCalculator && !isReadOnly

  return (
    <div className="relative w-full">
      <Input
        {...inputProps}
        ref={setRef}
        value={value}
        type="text"
        inputMode="decimal"
        className={`${className ?? ''} text-left transition-all duration-200 ${showCalculator ? 'pr-36' : ''}`}
        onChange={event => {
          if (isReadOnly) return
          if (/^-?[0-9.()+\-*/×÷\s]*$/.test(event.target.value)) onChange?.(event)
        }}
        onFocus={event => { if (!isReadOnly) setFocused(true); onFocus?.(event) }}
        onBlur={event => {
          // Resolve any pending expression (e.g. "12.00×5.00") when leaving the
          // field, matching the =/Enter behaviour.
          if (!isReadOnly) evaluate()
          setFocused(false)
          onBlur?.(event)
        }}
        onKeyDown={event => {
          if (isReadOnly) return
          if (event.key === 'Enter' || event.key === '=') {
            event.preventDefault()
            evaluate()
          }
          onKeyDown?.(event)
        }}
      />

      {showCalculator && (
        // Five 44px global targets consume nearly the whole compact input. Keep these
        // keyboard-accessible compound keys dense so the amount itself remains readable.
        <div
          data-smart-amount-calculator
          className="absolute right-1.5 top-1/2 flex -translate-y-1/2 overflow-hidden rounded-lg border border-border/80 bg-card/95 shadow-sm [&_button]:!min-h-8 [&_button]:!min-w-0"
        >
          {[
            ['+', '+'],
            ['−', '-'],
            ['×', '×'],
            ['÷', '÷'],
          ].map(([label, operator]) => (
            <Button variant="tertiary"
              key={operator}
              type="button"
              onMouseDown={event => { event.preventDefault(); appendOperator(operator) }}
              className="border-r border-border/50 px-2 py-1.5 text-xs font-semibold hover:bg-muted/80"
            >
              {label}
            </Button>
          ))}
          <Button variant="tertiary"
            type="button"
            onMouseDown={event => { event.preventDefault(); evaluate() }}
            className="bg-primary/10 px-2.5 py-1.5 text-xs font-bold text-accent-ink hover:bg-primary/20"
          >
            =
          </Button>
        </div>
      )}
    </div>
  )
})

SmartAmountInput.displayName = 'SmartAmountInput'
