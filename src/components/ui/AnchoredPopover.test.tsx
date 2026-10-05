import { useRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AnchoredPopover } from './AnchoredPopover'

function Harness({ onDismiss }: { onDismiss: () => void }) {
  const anchorRef = useRef<HTMLDivElement>(null)
  return (
    <>
      <div ref={anchorRef}><input aria-label="Description" /></div>
      <p>Elsewhere</p>
      <AnchoredPopover open anchorRef={anchorRef} onDismiss={onDismiss}>
        <span>Suggestion</span>
      </AnchoredPopover>
    </>
  )
}

describe('AnchoredPopover dismissal', () => {
  it('dismisses on a press outside the anchor and panel', () => {
    const onDismiss = vi.fn()
    render(<Harness onDismiss={onDismiss} />)
    fireEvent.pointerDown(screen.getByText('Elsewhere'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('stays open for presses on the anchor or inside the panel', () => {
    const onDismiss = vi.fn()
    render(<Harness onDismiss={onDismiss} />)
    fireEvent.pointerDown(screen.getByLabelText('Description'))
    fireEvent.pointerDown(screen.getByText('Suggestion'))
    expect(onDismiss).not.toHaveBeenCalled()
  })
})
