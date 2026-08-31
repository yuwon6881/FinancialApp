import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ToggleButton } from './ToggleButton'

describe('ToggleButton mutation feedback', () => {
  it('overlays an accessible status without adding a sibling beside the control', () => {
    const { container, rerender } = render(
      <ToggleButton active={false} label="Bill reminders" onClick={vi.fn()} />,
    )
    const toggle = screen.getByRole('switch', { name: 'Bill reminders' })

    expect(toggle.querySelector('[data-mutation-status-slot]')).toBeNull()

    rerender(
      <ToggleButton
        active
        disabled
        label="Bill reminders"
        onClick={vi.fn()}
        mutationStatus={{ isSyncing: true }}
        mutationEntityLabel="bill reminders"
      />,
    )

    const busyToggle = screen.getByRole('switch', { name: 'Bill reminders' })
    const slot = busyToggle.querySelector('[data-mutation-status-slot]')
    expect(busyToggle.getAttribute('aria-checked')).toBe('true')
    expect(busyToggle.getAttribute('aria-busy')).toBe('true')
    expect(slot?.className).toContain('absolute')
    expect(screen.getByRole('status', { name: 'Updating bill reminders…' })).toBeTruthy()
    expect(container.querySelector('button + [data-mutation-status-slot]')).toBeNull()
  })
})
