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

  const allowCalculator = inputWidth >= 220

  const publishValue = (nextValue: string) => {
    const input = inputRef.current
    if (!input) return
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, nextValue)
    onChange?.({ target: input, currentTarget: input } as React.ChangeEvent<HTMLInputElement>)
  }

  const evaluate = () => {
    const expression = inputRef.current?.value.trim() ?? ''
    if (!expression) return
    const result = evaluateMathString(expression)
    if (result !== null) publishValue(Number(result.toFixed(2)).toString())
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
        className={`${className ?? ''} text-right transition-all duration-200 ${showCalculator ? 'pr-36' : ''}`}
        onChange={event => {
          if (/^-?[0-9.()+\-*/×÷\s]*$/.test(event.target.value)) onChange?.(event)
        }}
        onFocus={event => { setFocused(true); onFocus?.(event) }}
        onBlur={event => { setFocused(false); onBlur?.(event) }}
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
