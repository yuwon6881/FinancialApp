import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OverflowMenu } from './OverflowMenu'

const items = (overrides: Partial<Parameters<typeof OverflowMenu>[0]> = {}) => ({
  entityLabel: 'Car Maintenance',
  items: [
    { label: 'Release money', onSelect: vi.fn() },
    { label: 'Edit', onSelect: vi.fn() },
    { label: 'Delete', onSelect: vi.fn(), tone: 'danger' as const },
  ],
  ...overrides,
})

const trigger = () => screen.getByRole('button', { name: 'More actions for Car Maintenance' })

describe('OverflowMenu', () => {
  it('names the record it acts on and reports its expanded state', () => {
    render(<OverflowMenu {...items()} />)

    expect(trigger().getAttribute('aria-haspopup')).toBe('menu')
    expect(trigger().getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(trigger())
    expect(trigger().getAttribute('aria-expanded')).toBe('true')
  })

  it('reveals the actions as a menu', () => {
    render(<OverflowMenu {...items()} />)
    fireEvent.click(trigger())

    expect(screen.getByRole('menu', { name: 'Actions for Car Maintenance' })).toBeTruthy()
    expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual([
      'Release money', 'Edit', 'Delete',
    ])
  })

  it('closes before invoking the action so an opening sheet is not dismissed with it', () => {
    const onSelect = vi.fn()
    render(<OverflowMenu {...items({ items: [{ label: 'Edit', onSelect }] })} />)

    fireEvent.click(trigger())
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
  })

  it('keeps a disabled item inert but still explains why', () => {
    const onSelect = vi.fn()
    render(<OverflowMenu {...items({
      items: [{ label: 'Delete', onSelect, disabled: true, hint: 'Unhide balances to delete' }],
    })} />)

    fireEvent.click(trigger())
    const item = screen.getByRole('menuitem', { name: 'Delete' })
    expect(item.getAttribute('aria-disabled')).toBe('true')
    expect(item.getAttribute('title')).toBe('Unhide balances to delete')

    fireEvent.click(item)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('walks into the menu on ArrowDown and cycles, skipping disabled items', () => {
    // Opening does not steal focus — the popover remounts its panel after measuring, so anything
    // focused before that would be detached, and a pointer user does not want focus moved.
    render(<OverflowMenu {...items({
      items: [
        { label: 'Release money', onSelect: vi.fn() },
        { label: 'Edit', onSelect: vi.fn(), disabled: true, hint: 'no' },
        { label: 'Delete', onSelect: vi.fn() },
      ],
    })} />)

    fireEvent.click(trigger())

    fireEvent.keyDown(document, { key: 'ArrowDown' })
    expect(document.activeElement?.textContent).toBe('Release money')

    fireEvent.keyDown(document, { key: 'ArrowDown' })
    expect(document.activeElement?.textContent).toBe('Delete')

    fireEvent.keyDown(document, { key: 'ArrowDown' })
    expect(document.activeElement?.textContent).toBe('Release money')

    fireEvent.keyDown(document, { key: 'End' })
    expect(document.activeElement?.textContent).toBe('Delete')
  })

  it('walks in from the bottom on ArrowUp', () => {
    render(<OverflowMenu {...items()} />)
    fireEvent.click(trigger())

    fireEvent.keyDown(document, { key: 'ArrowUp' })
    expect(document.activeElement?.textContent).toBe('Delete')
  })

  it('closes on Escape and hands focus back to the trigger', () => {
    render(<OverflowMenu {...items()} />)
    fireEvent.click(trigger())

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(trigger().getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger())
  })

  it('closes itself when the card becomes unavailable mid-interaction', () => {
    const { rerender } = render(<OverflowMenu {...items()} />)
    fireEvent.click(trigger())

    rerender(<OverflowMenu {...items({ disabled: true })} />)

    expect(trigger().getAttribute('aria-expanded')).toBe('false')
  })

  it('renders nothing when there are no actions', () => {
    render(<OverflowMenu {...items({ items: [] })} />)

    expect(screen.queryByRole('button', { name: /More actions/ })).toBeNull()
  })
})
