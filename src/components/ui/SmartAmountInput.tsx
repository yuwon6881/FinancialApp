import React, { type InputHTMLAttributes, useState, useRef, useEffect } from 'react'
import { evaluateMathString } from '../../lib/math'

export const SmartAmountInput = React.forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>((props, ref) => {
  const { onBlur, onFocus, onKeyDown, value, className, ...rest } = props
  const [isFocused, setIsFocused] = useState(false)
  const internalRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (typeof ref === 'function') {
      ref(internalRef.current)
    } else if (ref) {
      ref.current = internalRef.current
    }
  }, [ref])

  const handleEvaluate = (e: React.FocusEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement> | { target: HTMLInputElement }) => {
    const input = e.target as HTMLInputElement
    const val = input.value
    // If empty or already a valid pure number with max 2 decimals, skip evaluation to save ops
    if (!val || /^\d+(\.\d{1,2})?$/.test(val)) return

    const evaluated = evaluateMathString(val)
    if (evaluated !== null) {
      const fixedVal = evaluated.toFixed(2)
      if (val !== fixedVal) {
        // Use native setter to trigger React's synthetic onChange event
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
        nativeInputValueSetter?.call(input, fixedVal)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
    }
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false)
    handleEvaluate(e)
    if (onBlur) onBlur(e)
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true)
    if (onFocus) onFocus(e)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === '=') {
      if (e.key === '=') {
        e.preventDefault() // prevent typing '='
      }
      handleEvaluate(e)
    }
    if (onKeyDown) onKeyDown(e)
  }

  const appendOperator = (op: string) => {
    if (!internalRef.current) return
    const input = internalRef.current
    let val = input.value || ''
    
    // If the last character is already an operator, replace it
    if (/[+\-*/]$/.test(val)) {
      val = val.slice(0, -1) + op
    } else {
      val += op
    }

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    nativeInputValueSetter?.call(input, val)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }

  return (
    <div className="relative w-full">
      <input
        ref={internalRef}
        value={value}
        onBlur={handleBlur}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        className={className}
        inputMode="decimal"
        {...rest}
      />
      {isFocused && (
        <div className="absolute top-full right-0 mt-1.5 flex items-center bg-card border border-border/80 shadow-lg rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 z-50">
          {['+', '-', '*', '/'].map(op => (
            <button
              key={op}
              type="button"
              onMouseDown={e => {
                e.preventDefault()
                appendOperator(op)
              }}
              className="px-3.5 py-2 text-sm font-semibold text-foreground hover:bg-muted/50 active:bg-muted border-r border-border/50 transition cursor-pointer"
            >
              {op}
            </button>
          ))}
          <button
            type="button"
            onMouseDown={e => {
              e.preventDefault()
              if (internalRef.current) {
                handleEvaluate({ target: internalRef.current })
              }
            }}
            className="px-3.5 py-2 text-sm font-bold text-blue-600 bg-blue-500/10 hover:bg-blue-500/20 active:bg-blue-500/30 transition cursor-pointer"
          >
            =
          </button>
        </div>
      )}
    </div>
  )
})

SmartAmountInput.displayName = 'SmartAmountInput'
