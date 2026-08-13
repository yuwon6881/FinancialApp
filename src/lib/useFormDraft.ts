import { useEffect, useRef } from 'react'
import { getModalDraft, setModalDraft, clearModalDraft } from './modalDrafts'

/**
 * Persists an open modal's field values so they survive being torn down
 * unexpectedly -- a forced logout (server cold-start -> expired session),
 * an accidental tab switch, or a page reload -- instead of the user's typed
 * input silently vanishing. Route-mounted forms can opt out of automatic
 * restoration when reopening a page should never reopen a sheet.
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
 *   // Pass { restoreOnMount: false } for a form that should only open after
 *   // an explicit user action, while still retaining its draft while open.
 * Then call clearDraft() from every path that intentionally closes the modal
 * (cancel, backdrop dismiss, successful submit) -- everything else (backup on
 * logout, and restore on relogin when enabled) is handled generically, with no
 * further wiring.
 */
export function useFormDraft<T>(
  modalId: string,
  isOpen: boolean,
  value: T,
  onRestore: (draft: T) => void,
  options?: { restoreOnMount?: boolean },
): { clearDraft: () => void } {
  const onRestoreRef = useRef(onRestore)
  const restoreOnMount = options?.restoreOnMount ?? true
  useEffect(() => {
    onRestoreRef.current = onRestore
  }, [onRestore])

  // Restore-on-mount only -- this runs once when the owning component first
  // mounts (e.g. right after relogin remounts the app, or the tab becomes
  // active again), not on every render.
  useEffect(() => {
    if (!restoreOnMount) return
    const draft = getModalDraft<T>(modalId)
    if (draft !== undefined) {
      onRestoreRef.current(draft)
    }
  }, [modalId, restoreOnMount])

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
