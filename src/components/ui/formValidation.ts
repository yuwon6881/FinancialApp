export function focusFirstInvalidField(root: ParentNode) {
  window.requestAnimationFrame(() => {
    root.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  })
}
