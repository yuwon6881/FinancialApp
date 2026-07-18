// Vitest's builtin jsdom environment, with one twist: `import('jsdom')` is
// redirected to the single-file bundle produced by scripts/bundle-test-dom.mjs.
//
// Why: endpoint-security software on some dev machines adds ~7ms to every file
// open, so importing jsdom's ~3,000 module files takes longer than vitest's
// hardcoded 60s worker-start timeout and every test file dies before running.
// One large file opens in milliseconds. Delegating to the builtin environment
// keeps all of vitest's jsdom compat patches (Request/URL/Blob interop,
// window-error capture) without maintaining a copy here.
import { existsSync } from 'node:fs'
import Module from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { builtinEnvironments } from 'vitest/runtime'

const bundlePath = path.resolve(
  process.cwd(), 'node_modules', '.cache', 'jsdom-bundle', 'lib', 'jsdom', 'living', 'jsdom.cjs',
)

// module.registerHooks needs Node >= 22.15. Where it (or the bundle) is
// missing — e.g. CI on an older Node, which has no scanner tax anyway — fall
// back silently to the builtin environment's stock import('jsdom').
const registerHooks = (Module as { registerHooks?: (hooks: object) => void }).registerHooks

if (typeof registerHooks === 'function' && existsSync(bundlePath)) {
  const bundleUrl = pathToFileURL(bundlePath).href
  registerHooks({
    resolve(specifier: string, context: unknown, nextResolve: (s: string, c: unknown) => unknown) {
      if (specifier === 'jsdom') {
        return { url: bundleUrl, shortCircuit: true }
      }
      return nextResolve(specifier, context)
    },
  })
}

export default {
  ...builtinEnvironments.jsdom,
  name: 'jsdom-bundled',
  // Vitest only selects its client transform pipeline when the configured
  // environment name is one of its built-ins ("jsdom" or "happy-dom"). A
  // custom environment path is collected through the SSR pipeline, so its
  // runtime pipeline must match or Windows setup-file URLs such as /@fs/C:/...
  // are handed to the wrong module runner and cannot be resolved.
  viteEnvironment: 'ssr',
}
