const INVALID_SELECTOR = '[aria-invalid="true"]'
const ERROR_TEXT_SELECTOR = '[role="alert"]'

function reveal(element: HTMLElement | null | undefined, focus: boolean) {
  if (!element) return
  // A tall sheet on mobile scrolls its own body, so an inline error can land
  // below the fold — which reproduces the very problem inline validation was
  // meant to solve. Bring it into view before focusing.
  element.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  if (focus) element.focus?.()
}

type FieldRoot = ParentNode | { current: ParentNode | null } | null | undefined

/**
 * Accepts a ref object as well as a node so callers never have to read
 * `ref.current` in render scope, which the React Compiler lint rejects.
 */
export function focusFirstInvalidField(target: FieldRoot) {
  window.requestAnimationFrame(() => {
    const root = target && 'current' in target ? target.current : target
    if (!root) return
    const invalid = root.querySelector<HTMLElement>(INVALID_SELECTOR)
    if (invalid) {
      reveal(invalid, true)
      return
    }
    // Some controls (custom selects, file pickers) render their message without
    // an focusable aria-invalid host; scrolling the message itself into view is
    // still better than leaving the user staring at an unchanged form.
    reveal(root.querySelector<HTMLElement>(ERROR_TEXT_SELECTOR), false)
  })
}

/**
 * Same behaviour for forms that are not submitted through a `<form>` element —
 * pass the container ref that wraps the fields.
 */
export const revealFirstFieldError = focusFirstInvalidField
