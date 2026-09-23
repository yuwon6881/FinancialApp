/** Native-only Android Back and external URL handling. */
export async function installNativeNavigation(): Promise<() => void> {
  const { App } = await import('@capacitor/app')
  const backButton = await App.addListener('backButton', () => {
    const modal = document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]')
    if (modal) {
      const escape = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      })
      modal.dispatchEvent(escape)
      if (escape.defaultPrevented) return
    }

    const historyIndex = window.history.state?.idx
    if (typeof historyIndex === 'number' && historyIndex > 0) {
      window.history.back()
    } else {
      void App.exitApp()
    }
  })

  const onDocumentClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    if (!(event.target instanceof Element)) return
    const anchor = event.target.closest<HTMLAnchorElement>('a[href]')
    if (!anchor || anchor.hasAttribute('download')) return

    let url: URL
    try {
      url = new URL(anchor.href)
    } catch {
      return
    }
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.origin === window.location.origin) return

    event.preventDefault()
    void import('@capacitor/browser').then(({ Browser }) => Browser.open({ url: url.toString() }))
      .catch(error => console.warn('Could not open the external link.', error))
  }
  document.addEventListener('click', onDocumentClick, true)

  return () => {
    void backButton.remove()
    document.removeEventListener('click', onDocumentClick, true)
  }
}
