import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CustomSelect } from './CustomSelect'
import { DatePicker } from './DatePicker'
import { PillSwitch } from './PillSwitch'

describe('floating form controls', () => {
  it('portals select options outside clipping containers and keeps selection working', () => {
    const onChange = vi.fn()
    render(
      <div data-testid="clipping-parent" style={{ overflow: 'hidden', maxHeight: 20 }}>
        <CustomSelect
          value="one"
          onChange={onChange}
          options={[
            { value: 'one', label: 'One' },
            { value: 'two', label: 'Two' },
          ]}
        />
      </div>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'One' }))
    const option = screen.getByRole('button', { name: 'Two' })

    expect(screen.getByTestId('clipping-parent').contains(option)).toBe(false)
    expect(option.closest('[data-floating-overlay]')).not.toBeNull()

    fireEvent.click(option)
    expect(onChange).toHaveBeenCalledWith('two')
  })

  it('uses the shared date picker constraints inside its portalled calendar', () => {
    const onChange = vi.fn()
    render(
      <DatePicker
        value="2026-07-17"
        min="2026-07-10"
        max="2026-07-20"
        onChange={onChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Jul 17, 2026/i }))

    expect((screen.getByRole('button', { name: '9' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: '20' }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByRole('button', { name: '21' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('dialog', { name: 'Choose date' }).closest('body')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '20' }))
    expect(onChange).toHaveBeenCalledWith('2026-07-20')
  })

  it('exposes the recurring filter pill as an accessible switch', () => {
    const onChange = vi.fn()
    render(<PillSwitch checked={false} onChange={onChange} ariaLabel="Recurring transactions only" />)

    const toggle = screen.getByRole('switch', { name: 'Recurring transactions only' })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    expect(toggle.textContent).toContain('Off')

    fireEvent.click(toggle)
    expect(onChange).toHaveBeenCalledWith(true)
  })
})
