/**
 * An update reload is safe only when the user is not inside a transient edit surface. Durable
 * outbox work is intentionally not part of this check: it is already stored before dispatch.
 */
export function hasUncommittedFormEdits(documentValue: Document): boolean {
  const openDialog = Array.from(documentValue.querySelectorAll('[role="dialog"], [aria-modal="true"]'))
    .some(element => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true')
  if (openDialog) return true

  const activeElement = documentValue.activeElement
  if (activeElement?.matches('input, textarea, select, [contenteditable="true"]')) return true

  for (const input of Array.from(documentValue.querySelectorAll('input'))) {
    const type = input.type.toLowerCase()
    if (['button', 'submit', 'reset', 'hidden'].includes(type)) continue
    if (type === 'checkbox' || type === 'radio') {
      if (input.checked !== input.defaultChecked) return true
    } else if (input.value !== input.defaultValue) {
      return true
    }
  }

  for (const textarea of Array.from(documentValue.querySelectorAll('textarea'))) {
    if (textarea.value !== textarea.defaultValue) return true
  }

  for (const select of Array.from(documentValue.querySelectorAll('select'))) {
    if (Array.from(select.options).some(option => option.selected !== option.defaultSelected)) return true
  }

  return Array.from(documentValue.querySelectorAll('[contenteditable="true"]'))
    .some(element => element.hasAttribute('data-dirty'))
}

export function getWorkerActivationAction(
  updateRequestedByThisTab: boolean,
  updateWaitingForThisTab: boolean,
  hadControllerBeforeActivation = false,
): 'reload-requesting-tab' | 'offer-safe-reload' | 'ignore' {
  if (updateRequestedByThisTab) return 'reload-requesting-tab'
  return updateWaitingForThisTab || hadControllerBeforeActivation ? 'offer-safe-reload' : 'ignore'
}

export function isStandaloneDisplayMode(
  windowValue: Pick<Window, 'matchMedia'>,
  navigatorValue: Navigator & { standalone?: boolean },
): boolean {
  return (typeof windowValue.matchMedia === 'function' && windowValue.matchMedia('(display-mode: standalone)').matches)
    || navigatorValue.standalone === true
}

export function getInstallInstructions(userAgent: string, maxTouchPoints = 0): string {
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent)
    || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)
  if (isIOS) {
    return 'In Safari, tap Share, then Add to Home Screen. If iOS offers Open as Web App, choose it for the installed app experience.'
  }
  if (/Android/i.test(userAgent)) {
    return 'Open the browser menu and choose Install app or Add to Home screen.'
  }
  return 'Open your browser menu and choose Install or Add to Home Screen if that option is available.'
}
