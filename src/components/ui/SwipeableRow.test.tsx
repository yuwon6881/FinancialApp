import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, beforeEach } from 'vitest'
import { SwipeableRow } from './SwipeableRow'
import { resolveSwipeTarget } from './swipeableRowMath'
import { closeOpenSwipeableRow } from '../../lib/swipeLock'

describe('SwipeableRow swipe resolution', () => {
  const actionsWidth = 132

  it('opens immediately for a fast left swipe even before crossing half the drawer', () => {
    expect(resolveSwipeTarget({ currentX: -18, actionsWidth, velocityX: -520 })).toBe(-actionsWidth)
  })

  it('closes immediately for a fast right swipe', () => {
    expect(resolveSwipeTarget({ currentX: -120, actionsWidth, velocityX: 460 })).toBe(0)
  })

  it('uses the settled position for slow swipes and clamps overshoot', () => {
    expect(resolveSwipeTarget({ currentX: -70, actionsWidth, velocityX: 0 })).toBe(-actionsWidth)
    expect(resolveSwipeTarget({ currentX: -20, actionsWidth, velocityX: 0 })).toBe(0)
    expect(resolveSwipeTarget({ currentX: -400, actionsWidth, velocityX: 0 })).toBe(-actionsWidth)
    expect(resolveSwipeTarget({ currentX: 40, actionsWidth, velocityX: 0 })).toBe(0)
  })
})

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

  const renderRow = (className?: string) => render(
    <SwipeableRow
      actions={<button type="button">Delete</button>}
      className={className}
      contentClassName="p-4"
    >
      <p>Row body</p>
    </SwipeableRow>,
  )

  it('keeps the sliding surface opaque so the drawer stays hidden until swiped', () => {
    renderRow('bg-card/92')
    const surface = document.querySelector('[data-swipe-content]')
    expect(surface).not.toBeNull()
    expect(surface?.className).toContain('bg-card')
    expect(surface?.className).not.toContain('bg-card/92')
    expect((surface as HTMLElement | null)?.style.backgroundColor).toBe('var(--card)')
  })

  it('stacks the sliding surface above the drawer', () => {
    renderRow()
    expect(document.querySelector('[data-swipe-content]')?.className).toContain('z-10')
    expect(screen.getByText('Delete').closest('[role="group"]')?.className).toContain('z-0')
  })

  it('applies contentClassName on mobile, not just on the desktop branch', () => {
    renderRow()
    expect(document.querySelector('[data-swipe-content]')?.className).toContain('p-4')
  })

  it('moves the complete card surface instead of leaving its border on the viewport', () => {
    renderRow('rounded-2xl border border-border shadow-xs')
    const surface = document.querySelector('[data-swipe-content]')
    const viewport = surface?.parentElement

    expect(surface?.className).toContain('rounded-2xl')
    expect(surface?.className).toContain('border-border')
    expect(surface?.className).toContain('shadow-xs')
    expect(surface?.className).toContain('overflow-hidden')
    expect(viewport?.className).toContain('rounded-2xl')
    expect(viewport?.className).toContain('bg-card')
    expect(viewport?.className).not.toContain('border-border')
  })

  it('marks the drawer inert while the row is closed so its actions are unreachable', () => {
    renderRow()
    const drawer = screen.getByText('Delete').closest('[inert]')
    expect(drawer).not.toBeNull()
  })

  it('keeps the drawer hidden and transparent when closed to prevent border and corner color bleed', () => {
    renderRow('rounded-2xl border border-border shadow-xs')
    const deleteButton = screen.getByText('Delete')
    const drawer = deleteButton.closest('[role="group"]') as HTMLElement
    expect(drawer.style.opacity).toBe('0')
    expect(drawer.style.pointerEvents).toBe('none')
    expect(screen.queryByRole('button', { name: 'Show row actions' })).toBeNull()
  })

  it('does not render the bottom-right chevron disclosure button', () => {
    renderRow()
    expect(screen.queryByRole('button', { name: 'Show row actions' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Hide row actions' })).toBeNull()
  })
})
