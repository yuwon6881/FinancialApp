import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState, type FormEvent } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'
import { FormField } from './FormField'
import { focusFirstInvalidField } from './formValidation'
import { Input } from './Input'

function RequiredForm({ onValid }: { onValid: () => void }) {
  const [first, setFirst] = useState('')
  const [second, setSecond] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors: Record<string, string> = {}
    if (!first.trim()) nextErrors.first = 'First field is required.'
    if (!second.trim()) nextErrors.second = 'Second field is required.'
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      focusFirstInvalidField(event.currentTarget)
      return
    }
    onValid()
  }

  return (
    <form noValidate onSubmit={submit}>
      <FormField label="First field" required error={errors.first} hint="A helpful hint">
        <Input
          value={first}
          onChange={event => {
            setFirst(event.target.value)
            setErrors(previous => ({ ...previous, first: '' }))
          }}
        />
      </FormField>
      <FormField label="Second field" required error={errors.second}>
        <Input
          value={second}
          onChange={event => {
            setSecond(event.target.value)
            setErrors(previous => ({ ...previous, second: '' }))
          }}
        />
      </FormField>
      <Button type="submit">Save</Button>
    </form>
  )
}

describe('canonical form controls', () => {
  it('associates labels, hints, required state, and field errors', async () => {
    render(<RequiredForm onValid={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    const first = screen.getByRole('textbox', { name: /First field/ })
    expect(first.getAttribute('aria-required')).toBe('true')
    expect(first.getAttribute('aria-invalid')).toBe('true')
    expect(first.getAttribute('aria-describedby')).toContain('-hint')
    expect(first.getAttribute('aria-describedby')).toContain('-error')
    expect(screen.getByText('First field is required.').getAttribute('role')).toBe('alert')
    await waitFor(() => expect(document.activeElement).toBe(first))
  })

  it('clears only the edited field error and suppresses the valid action', async () => {
    const onValid = vi.fn()
    render(<RequiredForm onValid={onValid} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    fireEvent.change(screen.getByRole('textbox', { name: /First field/ }), {
      target: { value: 'ready' },
    })

    expect(screen.queryByText('First field is required.')).toBeNull()
    expect(screen.getByText('Second field is required.')).not.toBeNull()
    expect(onValid).not.toHaveBeenCalled()
  })
})
