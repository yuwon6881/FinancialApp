import { afterAll, afterEach, beforeEach } from 'vitest'
import { server } from './msw/server'
import { resetBackend } from './msw/backend'

// Start the mock server at module-eval time (before any test module imports the API
// client), so client.ts captures the MSW-patched global fetch as its `originalFetch`.
// Unhandled requests are bypassed so existing unit tests that mock at the module
// level are unaffected by this global setup.
server.listen({ onUnhandledRequest: 'bypass' })

// jsdom intentionally reports scrollTo() as unimplemented. Components use it
// only as a browser side effect, so make it a quiet no-op in unit tests.
Object.defineProperty(window, 'scrollTo', {
  configurable: true,
  writable: true,
  value: () => undefined,
})

// jsdom does not implement matchMedia. Modal dialogs (BottomSheet -> useDialog /
// useIsMobile) query it, so provide a desktop-defaulting stub for every test.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  })
}

beforeEach(() => {
  resetBackend()
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})
