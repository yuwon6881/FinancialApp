import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

    fireEvent.click(screen.getByRole('combobox', { name: 'Select an option' }))
    const option = screen.getByRole('option', { name: 'Two' })

    expect(screen.getByTestId('clipping-parent').contains(option)).toBe(false)
    expect(option.closest('[data-floating-overlay]')).not.toBeNull()

    fireEvent.click(option)
    expect(onChange).toHaveBeenCalledWith('two')
  })

  it('supports standard select-only keyboard interaction', () => {
    const onChange = vi.fn()
    render(
      <CustomSelect
        ariaLabel="Cycle month"
        value="one"
        onChange={onChange}
        options={[
          { value: 'one', label: 'One' },
          { value: 'two', label: 'Two' },
        ]}
      />,
    )

    const select = screen.getByRole('combobox', { name: 'Cycle month' })
    fireEvent.keyDown(select, { key: 'ArrowDown' })
    expect(select.getAttribute('aria-expanded')).toBe('true')
    fireEvent.keyDown(select, { key: 'ArrowDown' })
    fireEvent.keyDown(select, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('two')
  })

  it('keeps long option rows at their natural height inside a scrollable menu', () => {
    render(
      <CustomSelect
        value="one"
        onChange={vi.fn()}
        options={[
          { value: 'one', label: 'One' },
          ...Array.from({ length: 20 }, (_, index) => ({
            value: `long-${index}`,
            label: `A long multi-line option ${index} with supporting detail and an amount`,
          })),
        ]}
      />,
    )

    fireEvent.click(screen.getByRole('combobox', { name: 'Select an option' }))
    const option = screen.getByRole('option', { name: /A long multi-line option 0/i })
    const menu = option.closest('[data-floating-overlay]')

    expect(menu?.className).toContain('overflow-y-auto')
    expect(menu?.className).not.toContain('flex-col')
    expect(option.className).toContain('h-auto')
    expect(option.className).toContain('whitespace-normal')
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

    expect((screen.getByRole('gridcell', { name: /^[^,]+, (9 July 2026|July 9, 2026)$/i }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('gridcell', { name: /^[^,]+, (20 July 2026|July 20, 2026)$/i }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByRole('gridcell', { name: /^[^,]+, (21 July 2026|July 21, 2026)$/i }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('dialog', { name: 'Choose date' }).closest('body')).not.toBeNull()

    fireEvent.click(screen.getByRole('gridcell', { name: /^[^,]+, (20 July 2026|July 20, 2026)$/i }))
    expect(onChange).toHaveBeenCalledWith('2026-07-20')
  })

  it('moves calendar focus with the keyboard and restores trigger focus on Escape', async () => {
    render(<DatePicker value="2026-07-17" onChange={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: /Choose date: Jul 17, 2026/i })
    fireEvent.click(trigger)

    const selected = screen.getByRole('gridcell', { name: /^[^,]+, (17 July 2026|July 17, 2026)$/i })
    selected.focus()
    fireEvent.keyDown(selected, { key: 'ArrowRight' })
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('gridcell', { name: /^[^,]+, (18 July 2026|July 18, 2026)$/i })))

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Choose date' })).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('keeps clear as a sibling action and exposes disabled and invalid states', () => {
    const { rerender } = render(
      <DatePicker value="2026-07-17" onChange={vi.fn()} clearable invalid />,
    )
    const trigger = screen.getByRole('button', { name: /Choose date/i })
    const clear = screen.getByRole('button', { name: 'Clear date' })
    expect(trigger.contains(clear)).toBe(false)
    expect(trigger.getAttribute('aria-invalid')).toBe('true')

    rerender(<DatePicker value="2026-07-17" onChange={vi.fn()} disabled />)
    expect((screen.getByRole('button', { name: /Choose date/i }) as HTMLButtonElement).disabled).toBe(true)
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
