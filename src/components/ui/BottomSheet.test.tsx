import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BottomSheet } from './BottomSheet'
import { Button } from './Button'
import { ModalActions } from './ModalActions'

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
            <Button variant="outline">Cancel</Button>
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
})
