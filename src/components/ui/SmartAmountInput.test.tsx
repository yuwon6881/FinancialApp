import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
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
// Rendered through a portal to document.body to reproduce the real modal --
// a native `input` event would not reach React's root listener from there, so
// this guards against relying on dispatchEvent.
function MaskedWrapper({ calculator }: { calculator?: 'inline' | 'tray' } = {}) {
  const [value, setValue] = useState('')
  return createPortal(
    <SmartAmountInput
      aria-label="amount"
      calculator={calculator}
      value={value}
      onChange={e => setValue(maskCurrencyInput(e.target.value, value))}
    />,
    document.body
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

  it('enters multiplication and division operands as whole numbers by default', () => {
    render(<MaskedWrapper />)
    const input = screen.getByLabelText('amount') as HTMLInputElement

    fireEvent.change(input, { target: { value: '12.00*5' } })
    expect(input.value).toBe('12.00×5')

    fireEvent.change(input, { target: { value: '12.00/3' } })
    expect(input.value).toBe('12.00÷3')
    fireEvent.keyDown(input, { key: '=' })
    expect(input.value).toBe('4.00')
  })

  it('preserves an explicitly entered decimal multiplier or divisor', () => {
    render(<MaskedWrapper />)
    const input = screen.getByLabelText('amount') as HTMLInputElement

    fireEvent.change(input, { target: { value: '12.00*0.5' } })
    expect(input.value).toBe('12.00×0.5')
    fireEvent.keyDown(input, { key: '=' })
    expect(input.value).toBe('6.00')

    fireEvent.change(input, { target: { value: '12.00*.5' } })
    expect(input.value).toBe('12.00×0.5')
  })

  it('keeps cents-push entry for addition and subtraction operands', () => {
    render(<MaskedWrapper />)
    const input = screen.getByLabelText('amount') as HTMLInputElement

    fireEvent.change(input, { target: { value: '12.00+5-5' } })
    expect(input.value).toBe('12.00+0.05-0.05')
  })

  it('evaluates a pending expression when the field loses focus', () => {
    render(<MaskedWrapper />)
    const input = screen.getByLabelText('amount') as HTMLInputElement
    fireEvent.change(input, { target: { value: '10.00+5.00' } })
    fireEvent.blur(input)
    expect(input.value).toBe('15.00')
  })

  it('leaves an incomplete expression (trailing operator) untouched on blur', () => {
    render(<MaskedWrapper />)
    const input = screen.getByLabelText('amount') as HTMLInputElement
    fireEvent.change(input, { target: { value: '12.00+' } })
    fireEvent.blur(input)
    expect(input.value).toBe('12.00+')
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

describe('SmartAmountInput live result', () => {
  it('shows what an expression works out to before = is pressed', () => {
    render(<MaskedWrapper />)
    const input = screen.getByLabelText('amount') as HTMLInputElement
    fireEvent.change(input, { target: { value: '12.50*3' } })
    expect(screen.getByText('37.50')).toBeTruthy()
    fireEvent.keyDown(input, { key: '=' })
    expect(input.value).toBe('37.50')
    // A plain figure has nothing to work out, so the line goes away.
    expect(screen.queryByText(/=/)).toBeNull()
  })

  it('gives the tray its own always-visible keys that build and resolve the sum', () => {
    render(<MaskedWrapper calculator="tray" />)
    const input = screen.getByLabelText('amount') as HTMLInputElement
    expect(screen.getByText('Type a sum, like 12.50 × 3')).toBeTruthy()
    fireEvent.change(input, { target: { value: '12.00' } })
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Multiply' }))
    fireEvent.change(input, { target: { value: `${input.value}2` } })
    expect(screen.getByText('24.00')).toBeTruthy()
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Calculate result' }))
    expect(input.value).toBe('24.00')
  })
})
