import { useEffect, useRef } from 'react'
import { getModalDraft, setModalDraft, clearModalDraft } from './modalDrafts'

/**
 * Persists an open modal's field values so they survive being torn down
 * unexpectedly -- a forced logout (server cold-start -> expired session),
 * an accidental tab switch, or a page reload -- instead of the user's typed
 * input silently vanishing.
 *
 * To wire up a new modal:
 *   const { clearDraft } = useFormDraft(
 *     'my-modal',                          // unique id (append a record id for edit modals)
 *     isOpen,                              // the modal's own open/closed state
 *     { field1, field2 },                  // snapshot of its current field values
 *     (draft) => {                         // called once on mount if a draft was found
 *       setField1(draft.field1)
 *       setField2(draft.field2)
 *       setIsOpen(true)
 *     }
 *   )
 * Then call clearDraft() from every path that intentionally closes the modal
 * (cancel, backdrop dismiss, successful submit) -- everything else (backup on
 * logout, restore on relogin) is handled generically, with no further wiring.
 */
export function useFormDraft<T>(
  modalId: string,
  isOpen: boolean,
  value: T,
  onRestore: (draft: T) => void
): { clearDraft: () => void } {
  const onRestoreRef = useRef(onRestore)
  onRestoreRef.current = onRestore

  // Restore-on-mount only -- this runs once when the owning component first
  // mounts (e.g. right after relogin remounts the app, or the tab becomes
  // active again), not on every render.
  useEffect(() => {
    const draft = getModalDraft<T>(modalId)
    if (draft !== undefined) {
      onRestoreRef.current(draft)
    }
  }, [modalId])

  // Write-through while open. Deliberately does NOT clear on isOpen ->
  // false: that transition also happens transiently while onRestore is
  // reopening the modal (isOpen flips true on the next render, not this
  // one), and clearing here would race and delete the draft we just
  // restored. Closing is only ever "final" when the caller says so, hence
  // the explicit clearDraft() below.
  useEffect(() => {
    if (!isOpen) return
    setModalDraft(modalId, value)
  }, [modalId, isOpen, value])

  return {
    clearDraft: () => clearModalDraft(modalId)
  }
}
