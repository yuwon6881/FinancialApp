import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import { SmartAmountInput } from './SmartAmountInput'
import { maskCurrencyInput } from '../../lib/utils'

beforeAll(() => {
  // jsdom has no ResizeObserver; the component observes its own width.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

// Mirrors how the ledger amount field wires the input: every change runs
// through the cents mask, so the calculator result must survive that round-trip.
function MaskedWrapper() {
  const [value, setValue] = useState('')
  return (
    <SmartAmountInput
      aria-label="amount"
      value={value}
      onChange={e => setValue(maskCurrencyInput(e.target.value, value))}
    />
  )
}

describe('SmartAmountInput calculator', () => {
  it('evaluates a typed expression on the = key and stays mask-stable', () => {
    render(<MaskedWrapper />)
    const input = screen.getByLabelText('amount') as HTMLInputElement
    fireEvent.change(input, { target: { value: '12.00*5.00' } })
    expect(input.value).toBe('12.00×5.00')
    fireEvent.keyDown(input, { key: '=' })
    expect(input.value).toBe('60.00')
  })

  it('evaluates a pending expression when the field loses focus', () => {
    render(<MaskedWrapper />)
    const input = screen.getByLabelText('amount') as HTMLInputElement
    fireEvent.change(input, { target: { value: '10.00+5.00' } })
    fireEvent.blur(input)
    expect(input.value).toBe('15.00')
  })

  it('leaves a plain amount untouched', () => {
    render(<MaskedWrapper />)
    const input = screen.getByLabelText('amount') as HTMLInputElement
    fireEvent.change(input, { target: { value: '4200' } })
    expect(input.value).toBe('42.00')
    fireEvent.blur(input)
    expect(input.value).toBe('42.00')
  })
})
