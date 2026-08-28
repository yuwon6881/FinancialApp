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
// responsive tier hooks) query it, so provide a desktop-defaulting stub for every test.
//
// It evaluates min-width/max-width against window.innerWidth (jsdom defaults to
// 1024 = desktop) instead of hard-coding `matches: false`. A blanket false is not
// breakpoint-neutral: it answers "no" to both `(max-width: 767px)` and
// `(min-width: 768px)`, so which one a hook happens to use silently decides the
// layout. Everything else (prefers-reduced-motion, prefers-color-scheme: dark)
// still resolves to false, matching the previous default.
function evaluateMediaQuery(query: string): boolean {
  const width = window.innerWidth
  let matched = false
  const min = /\(\s*min-width:\s*([\d.]+)px\s*\)/.exec(query)
  if (min) {
    if (width < Number(min[1])) return false
    matched = true
  }
  const max = /\(\s*max-width:\s*([\d.]+)px\s*\)/.exec(query)
  if (max) {
    if (width > Number(max[1])) return false
    matched = true
  }
  return matched
}

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: evaluateMediaQuery(query),
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

// jsdom does not implement ResizeObserver. Responsive controls use it only to
// measure their rendered width, so unit tests need a no-op browser-compatible
// observer unless a test supplies a behavior-specific implementation.
if (!globalThis.ResizeObserver) {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
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
