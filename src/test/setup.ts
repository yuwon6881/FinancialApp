import { afterAll, afterEach, beforeEach } from 'vitest'
import { server } from './msw/server'
import { resetBackend } from './msw/backend'

// Start the mock server at module-eval time (before any test module imports the API
// client), so client.ts captures the MSW-patched global fetch as its `originalFetch`.
// Unhandled requests are bypassed so existing unit tests that mock at the module
// level are unaffected by this global setup.
server.listen({ onUnhandledRequest: 'bypass' })

beforeEach(() => {
  resetBackend()
  localStorage.clear()
})

afterEach(() => {
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})
