import React, { type InputHTMLAttributes } from 'react'
import { evaluateMathString } from '../../lib/math'

export const SmartAmountInput = React.forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>((props, ref) => {
  const { onBlur, onKeyDown, value, ...rest } = props

  const handleEvaluate = (e: React.FocusEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>) => {
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
    handleEvaluate(e)
    if (onBlur) onBlur(e)
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

  return (
    <input
      ref={ref}
      value={value}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      inputMode="decimal"
      {...rest}
    />
  )
})

SmartAmountInput.displayName = 'SmartAmountInput'
