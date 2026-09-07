import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Badge, StatusBadge } from './Badge'
import { Button } from './Button'
import { IconButton } from './IconButton'
import { Panel } from './Panel'
import { Tabs } from './Tabs'

describe('canonical UI primitives', () => {
  it.each(['primary', 'secondary', 'tertiary', 'destructive'] as const)(
    'renders the %s action with the shared control geometry',
    variant => {
      render(<Button variant={variant}>Continue</Button>)
      const button = screen.getByRole('button', { name: 'Continue' })
      expect(button.className).toContain('rounded-control')
      expect(button.className).toContain('min-h-12')
    },
  )

  it.each([
    ['sm', 'min-h-11'],
    ['md', 'min-h-12'],
    ['lg', 'min-h-13'],
    ['icon', 'size-11'],
  ] as const)('renders the %s control size from the shared scale', (size, expectedClass) => {
    render(<Button size={size} aria-label={`Example ${size}`}>Example</Button>)
    expect(screen.getByRole('button', { name: `Example ${size}` }).className).toContain(expectedClass)
  })

  it('honours explicit disabled state without losing its accessible name', () => {
    render(<Button disabled>Unavailable action</Button>)
    expect((screen.getByRole('button', { name: 'Unavailable action' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('keeps the original label in the accessibility tree while loading', () => {
    render(<Button loading loadingLabel="Saving">Save rules</Button>)
    const button = screen.getByRole('button', { name: /Save rules/i }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(screen.getByText('Saving').getAttribute('aria-hidden')).toBe('true')
  })

  it('requires an explicit accessible name for icon actions', () => {
    render(<IconButton label="Close panel"><span aria-hidden="true">×</span></IconButton>)
    expect(screen.getByRole('button', { name: 'Close panel' }).getAttribute('title')).toBe('Close panel')
  })

  it('moves tab selection and focus with the shared keyboard contract', () => {
    const onValueChange = vi.fn()
    render(
      <Tabs
        value="one"
        onValueChange={onValueChange}
        options={[
          { value: 'one', label: 'One', count: 1, panelId: 'panel-one' },
          { value: 'two', label: 'Two', count: 2, panelId: 'panel-two' },
        ] as const}
        label="Example sections"
        idPrefix="example-tab"
      />,
    )
    fireEvent.keyDown(screen.getByRole('tab', { name: /One/ }), { key: 'ArrowRight' })
    expect(onValueChange).toHaveBeenCalledWith('two')
  })

  it('exposes consistent panel and status semantics', () => {
    render(<Panel variant="subtle"><Badge tone="warning">Review</Badge><StatusBadge>Ready</StatusBadge></Panel>)
    expect(screen.getByText('Review').className).toContain('rounded-full')
    expect(screen.getByRole('status').textContent).toBe('Ready')
  })
})
