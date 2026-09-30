import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installNativeNavigation } from './nativeNavigation'

const native = vi.hoisted(() => ({
  back: null as ((event: { canGoBack: boolean }) => void) | null,
  exitApp: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(async (_event: string, callback: typeof native.back) => {
      native.back = callback
      return { remove: native.remove }
    }),
    exitApp: native.exitApp,
  },
}))

describe('Android Back navigation', () => {
  let cleanup: (() => void) | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    window.history.replaceState({}, '', '/')
  })

  afterEach(() => {
    cleanup?.()
    cleanup = undefined
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('uses the WebView history even when router state has no index', async () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined)
    cleanup = await installNativeNavigation()

    native.back?.({ canGoBack: true })

    expect(back).toHaveBeenCalledOnce()
    expect(native.exitApp).not.toHaveBeenCalled()
  })

  it('exits only when there is no WebView history', async () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined)
    cleanup = await installNativeNavigation()

    native.back?.({ canGoBack: false })

    expect(back).not.toHaveBeenCalled()
    expect(native.exitApp).toHaveBeenCalledOnce()
  })

  it('lets the active dialog handle Back before navigating or exiting', async () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined)
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('aria-modal', 'true')
    const dismiss = vi.fn((event: Event) => event.preventDefault())
    dialog.addEventListener('keydown', dismiss)
    document.body.append(dialog)
    cleanup = await installNativeNavigation()

    native.back?.({ canGoBack: true })

    expect(dismiss).toHaveBeenCalledOnce()
    expect(back).not.toHaveBeenCalled()
    expect(native.exitApp).not.toHaveBeenCalled()
  })
})
