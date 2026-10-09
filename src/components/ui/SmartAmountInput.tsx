import React, { type InputHTMLAttributes, useEffect, useRef, useState } from 'react'
import { Button } from './Button'
import { evaluateMathString } from '../../lib/math'
import { Input } from './Input'

interface SmartAmountInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /**
   * `inline` tucks the operator keys inside the field while it has focus (compact forms).
   * `tray` gives them a full-width row of their own under the field, always visible, for a form
   * where the amount is the hero.
   */
  calculator?: 'inline' | 'tray'
}

const OPERATOR_KEYS = [
  ['+', '+', 'Add'],
  ['−', '-', 'Subtract'],
  ['×', '×', 'Multiply'],
  ['÷', '÷', 'Divide'],
] as const

export const SmartAmountInput = React.forwardRef<HTMLInputElement, SmartAmountInputProps>((props, forwardedRef) => {
  const { className, onChange, onKeyDown, onFocus, onBlur, value, calculator = 'inline', ...inputProps } = props
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
  const isTray = calculator === 'tray'
  const showCalculator = !isTray && focused && allowCalculator && !isReadOnly
  // The answer before "=": once the field holds an operator (a leading minus is just a sign),
  // show what it works out to, so nobody has to commit an expression to check it.
  const expression = String(value ?? '')
  const liveResult = /[+\-×÷*/]/.test(expression.slice(1)) ? evaluateMathString(expression) : null

  return (
    <div className="relative w-full">
      <Input
        {...inputProps}
        ref={setRef}
        value={value}
        type="text"
        inputMode="decimal"
        className={`${className ?? ''} text-left transition-all duration-200 ${showCalculator ? 'pr-40' : ''}`}
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

      {!isTray && liveResult !== null && (
        <p aria-live="polite" className="mt-1.5 px-1 text-caption text-muted-foreground tabular-nums">
          {expression} = <span className="font-semibold text-foreground">{liveResult.toFixed(2)}</span>
        </p>
      )}

      {isTray && !isReadOnly && (
        <div className="mt-2 flex items-center justify-between gap-3">
          <p aria-live="polite" className="min-w-0 truncate text-caption text-muted-foreground tabular-nums">
            {liveResult !== null
              ? <>= <span className="text-label font-semibold text-foreground">{liveResult.toFixed(2)}</span></>
              : 'Type a sum, like 12.50 × 3'}
          </p>
          <div data-smart-amount-calculator className="flex shrink-0 items-center gap-1 rounded-full bg-surface-2 p-1">
            {OPERATOR_KEYS.map(([label, operator, ariaLabel]) => (
              <Button
                variant="tertiary"
                size="icon"
                key={operator}
                type="button"
                aria-label={ariaLabel}
                onMouseDown={event => { event.preventDefault(); appendOperator(operator) }}
                className="rounded-full text-callout text-foreground hover:bg-surface-3 lg:size-9"
              >
                {label}
              </Button>
            ))}
            <Button
              size="icon"
              type="button"
              aria-label="Calculate result"
              onMouseDown={event => { event.preventDefault(); evaluate() }}
              className="rounded-full bg-primary text-callout font-semibold text-primary-foreground hover:bg-primary/90 lg:size-9"
            >
              =
            </Button>
          </div>
        </div>
      )}

      {showCalculator && (
        // Five keyboard-accessible compound keys kept dense and flush so the amount itself remains readable.
        <div
          data-smart-amount-calculator
          className="absolute right-2 top-1/2 flex -translate-y-1/2 items-stretch overflow-hidden rounded-full border border-border/70 bg-card shadow-(--app-shadow) [&_button]:!h-8 [&_button]:!min-h-0 [&_button]:!min-w-0"
        >
          {OPERATOR_KEYS.map(([label, operator, ariaLabel]) => (
            <Button
              variant="tertiary"
              size="sm"
              key={operator}
              type="button"
              aria-label={ariaLabel}
              onMouseDown={event => { event.preventDefault(); appendOperator(operator) }}
              className="h-8 rounded-none border-r border-border/60 px-2.5 text-body font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground active:scale-95"
            >
              {label}
            </Button>
          ))}
          <Button
            variant="tertiary"
            size="sm"
            type="button"
            aria-label="Calculate result"
            onMouseDown={event => { event.preventDefault(); evaluate() }}
            className="h-8 rounded-none bg-primary px-3 text-body font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-95"
          >
            =
          </Button>
        </div>
      )}
    </div>
  )
})

SmartAmountInput.displayName = 'SmartAmountInput'
