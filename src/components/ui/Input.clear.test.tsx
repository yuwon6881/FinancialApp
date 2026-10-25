import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Input } from './Input'

function Clearable({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial)
  return <Input aria-label="Description" value={value} onChange={event => setValue(event.target.value)} onClear={() => setValue('')} clearLabel="Clear description" />
}

describe('Input clear button', () => {
  it('empties the field in one press and hands focus back to it', () => {
    render(<Clearable initial="GRAB* A-2B3C KUALA LUMPUR" />)
    const input = screen.getByLabelText('Description') as HTMLInputElement

    fireEvent.click(screen.getByRole('button', { name: 'Clear description' }))

    expect(input.value).toBe('')
    expect(document.activeElement).toBe(input)
    // Nothing left to clear, so the button steps aside.
    expect(screen.queryByRole('button', { name: 'Clear description' })).toBeNull()
  })

  it('is not offered on an empty field, nor on one without onClear', () => {
    render(<Clearable initial="" />)
    expect(screen.queryByRole('button', { name: 'Clear description' })).toBeNull()

    render(<Input aria-label="Plain" value="text" onChange={() => undefined} />)
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull()
  })
})
