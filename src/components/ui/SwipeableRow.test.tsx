import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, beforeEach } from 'vitest'
import { SwipeableRow } from './SwipeableRow'

// The mobile branch layers an action drawer behind a sliding content surface. That
// surface is the *only* thing hiding the drawer while the row is closed, so if it
// loses its opaque background every row renders looking permanently swiped open —
// Edit/Delete visible on every ledger card without any gesture. That regressed once
// when the surface's `bg-card` was dropped, which no test caught because nothing
// asserted on the closed row's paint order. These pin it.
describe('SwipeableRow closed-state opacity', () => {
  beforeEach(() => {
    // matchMedia in test/setup.ts resolves against innerWidth; below the 1024px
    // breakpoint useIsMobile reports mobile and the swipe branch renders.
    window.innerWidth = 500
  })

  const renderRow = () => render(
    <SwipeableRow actions={<button type="button">Delete</button>} contentClassName="p-4">
      <p>Row body</p>
    </SwipeableRow>,
  )

  it('keeps the sliding surface opaque so the drawer stays hidden until swiped', () => {
    renderRow()
    const surface = document.querySelector('[data-swipe-content]')
    expect(surface).not.toBeNull()
    expect(surface?.className).toContain('bg-card')
  })

  it('stacks the sliding surface above the drawer', () => {
    renderRow()
    expect(document.querySelector('[data-swipe-content]')?.className).toContain('relative')
  })

  it('applies contentClassName on mobile, not just on the desktop branch', () => {
    renderRow()
    expect(document.querySelector('[data-swipe-content]')?.className).toContain('p-4')
  })

  it('marks the drawer inert while the row is closed so its actions are unreachable', () => {
    renderRow()
    const drawer = screen.getByText('Delete').closest('[inert]')
    expect(drawer).not.toBeNull()
  })

  it('opens through an accessible disclosure and moves focus into the actions', async () => {
    renderRow()
    const disclosure = screen.getByRole('button', { name: 'Show row actions' })
    const actionsId = disclosure.getAttribute('aria-controls')

    expect(disclosure.getAttribute('aria-expanded')).toBe('false')
    expect(actionsId).toBeTruthy()
    fireEvent.click(disclosure)

    const drawer = document.getElementById(actionsId as string)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete' })))
    expect(disclosure.getAttribute('aria-expanded')).toBe('true')
    expect(drawer?.hasAttribute('inert')).toBe(false)
  })

  it('closes on Escape and restores focus to the disclosure', async () => {
    renderRow()
    fireEvent.click(screen.getByRole('button', { name: 'Show row actions' }))
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete' })))

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Show row actions' })))
    expect(screen.getByText('Delete').closest('[inert]')).not.toBeNull()
  })
})
