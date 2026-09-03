import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BottomSheet } from './BottomSheet'
import { Button } from './Button'
import { ModalActions } from './ModalActions'
import { APP_CONTEXT_WILL_CHANGE_EVENT } from '../../lib/appLocation'
import { createRef } from 'react'
import { InfoHint } from './InfoHint'

describe('BottomSheet HCI contract', () => {
  it('names and describes the dialog, traps focus, closes on Escape, and restores focus', async () => {
    const onClose = vi.fn()
    const trigger = document.createElement('button')
    trigger.textContent = 'Open'
    document.body.appendChild(trigger)
    trigger.focus()

    const { rerender } = render(
      <BottomSheet
        isOpen
        title="Edit record"
        description="Changes affect future records."
        onClose={onClose}
        footer={(
          <ModalActions>
            <Button variant="secondary">Cancel</Button>
            <Button>Save</Button>
          </ModalActions>
        )}
      >
        <Button>First action</Button>
      </BottomSheet>,
    )

    const dialog = screen.getByRole('dialog', { name: 'Edit record' })
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy()
    expect(screen.getByText('Changes affect future records.')).not.toBeNull()
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))

    const actions = within(dialog).getAllByRole('button')
    actions.forEach(action => {
      Object.defineProperty(action, 'offsetWidth', { configurable: true, value: 10 })
    })
    const last = actions.at(-1) as HTMLButtonElement
    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(actions[0])

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    rerender(
      <BottomSheet isOpen={false} title="Edit record" description="Changes affect future records." onClose={onClose}>
        <Button>First action</Button>
      </BottomSheet>,
    )
    await waitFor(() => expect(document.activeElement).toBe(trigger))
    trigger.remove()
  })

  it('allows only the top sheet in a stack to consume Escape', () => {
    const closeLower = vi.fn()
    const closeUpper = vi.fn()
    const { rerender } = render(
      <>
        <BottomSheet isOpen title="Lower sheet" onClose={closeLower}><Button>Lower action</Button></BottomSheet>
        <BottomSheet isOpen title="Upper sheet" onClose={closeUpper}><Button>Upper action</Button></BottomSheet>
      </>,
    )

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(closeUpper).toHaveBeenCalledTimes(1)
    expect(closeLower).not.toHaveBeenCalled()

    rerender(
      <>
        <BottomSheet isOpen title="Lower sheet" onClose={closeLower}><Button>Lower action</Button></BottomSheet>
        <BottomSheet isOpen={false} title="Upper sheet" onClose={closeUpper}><Button>Upper action</Button></BottomSheet>
      </>,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(closeLower).toHaveBeenCalledTimes(1)
  })

  it('uses an explicit accessible name when supplied', () => {
    render(
      <BottomSheet isOpen title="Internal title" ariaLabel="Public title" onClose={vi.fn()}>
        <Button>First action</Button>
      </BottomSheet>,
    )

    expect(screen.getByRole('dialog', { name: 'Public title' })).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: 'Internal title' })).toBeNull()
  })

  it('uses an explicit safe focus target instead of opening the first information tooltip', async () => {
    const closeRef = createRef<HTMLButtonElement>()
    render(
      <BottomSheet
        isOpen
        title="Cycle summary"
        onClose={vi.fn()}
        initialFocusRef={closeRef}
        footer={<Button ref={closeRef}>Close</Button>}
      >
        <InfoHint label="account balances" text="Balances at cycle close." />
      </BottomSheet>,
    )

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' })))
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('closes when the app route or selected cycle changes', () => {
    const onClose = vi.fn()
    render(
      <BottomSheet isOpen title="Repay loan" onClose={onClose}>
        <Button>Continue</Button>
      </BottomSheet>,
    )

    window.dispatchEvent(new Event(APP_CONTEXT_WILL_CHANGE_EVENT))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('focuses the panel without opening the mobile keyboard when the first control is text entry', async () => {
    const previousWidth = window.innerWidth
    window.innerWidth = 500

    try {
      render(
        <BottomSheet isOpen title="Add record" onClose={vi.fn()}>
          <input aria-label="Record name" />
        </BottomSheet>,
      )

      const dialog = screen.getByRole('dialog', { name: 'Add record' })
      const focus = vi.spyOn(dialog, 'focus')

      await waitFor(() => expect(document.activeElement).toBe(dialog))
      expect(focus).toHaveBeenCalledWith({ preventScroll: true })
      expect(document.activeElement).not.toBe(screen.getByRole('textbox', { name: 'Record name' }))
    } finally {
      window.innerWidth = previousWidth
    }
  })
})
