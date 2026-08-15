// Bundles jsdom into a single CJS file for the test environment.
//
// Why: endpoint-security software on some dev machines adds ~7ms to every file
// open, so importing jsdom's ~3,000 module files takes longer than vitest's
// hardcoded 60s worker-start timeout and every test file dies before running.
// One large file opens in milliseconds. src/test/bundledDomEnvironment.ts
// redirects the jsdom import to this bundle via module.registerHooks.
//
// Runs automatically via the "pretest" npm hook; skips work when the bundle is
// already up to date for the installed jsdom version.
import Module, { createRequire } from 'node:module'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// The bundle is only consumed via module.registerHooks (Node >= 22.15). On
// older runtimes the test environment falls back to the stock jsdom import,
// so building the bundle there would be wasted work.
if (typeof Module.registerHooks !== 'function') {
  console.log('[bundle-test-dom] module.registerHooks unavailable on this Node; skipping bundle')
  process.exit(0)
}

const require = createRequire(import.meta.url)
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// The bundle keeps jsdom's runtime `path.resolve(__dirname, "../../../browser/...")`
// asset lookup. Keep the collapsed file three directories below cacheRoot so
// that relative walk still lands on cacheRoot/browser/default-stylesheet.css.
const cacheRoot = path.join(projectRoot, 'node_modules', '.cache', 'jsdom-bundle')
const outDir = path.join(cacheRoot, 'lib', 'jsdom', 'living')
const outFile = path.join(outDir, 'jsdom.cjs')
const markerFile = path.join(cacheRoot, 'version.txt')
const stylesheetFile = path.join(cacheRoot, 'browser', 'default-stylesheet.css')
const xhrWorkerFile = path.join(outDir, 'xhr-sync-worker.js')
const cssTreeDataDir = path.join(cacheRoot, 'lib', 'jsdom', 'data')
const cssTreePatchFile = path.join(cssTreeDataDir, 'patch.json')
const cssTreePackageFile = path.join(cacheRoot, 'lib', 'jsdom', 'package.json')

const jsdomPkgPath = path.join(projectRoot, 'node_modules', 'jsdom', 'package.json')
const jsdomVersion = JSON.parse(readFileSync(jsdomPkgPath, 'utf8')).version

if (
  existsSync(outFile)
  && existsSync(markerFile)
  && existsSync(stylesheetFile)
  && existsSync(xhrWorkerFile)
  && existsSync(cssTreePatchFile)
  && existsSync(cssTreePackageFile)
  && readFileSync(markerFile, 'utf8') === jsdomVersion
) {
  console.log(`[bundle-test-dom] jsdom ${jsdomVersion} bundle is up to date`)
  process.exit(0)
}

const { rolldown } = await import('rolldown')

const entry = require.resolve('jsdom')
console.log(`[bundle-test-dom] bundling jsdom ${jsdomVersion} from ${entry}`)

const bundle = await rolldown({
  input: entry,
  platform: 'node',
  logLevel: 'silent',
})

mkdirSync(outDir, { recursive: true })
await bundle.write({ file: outFile, format: 'cjs', codeSplitting: false })
await bundle.close()

// jsdom reads these two files from disk at runtime; put them where the bundled
// code's __dirname-relative lookups land.
const jsdomLib = path.dirname(require.resolve('jsdom/package.json'))
mkdirSync(path.join(cacheRoot, 'browser'), { recursive: true })
copyFileSync(
  path.join(jsdomLib, 'lib', 'jsdom', 'browser', 'default-stylesheet.css'),
  stylesheetFile,
)
copyFileSync(
  path.join(jsdomLib, 'lib', 'jsdom', 'living', 'xhr', 'xhr-sync-worker.js'),
  xhrWorkerFile,
)

// css-tree uses createRequire(import.meta.url) for these JSON files. Rolldown
// cannot rewrite those dynamic relative loads, so preserve the paths they
// resolve against beside the collapsed bundle.
const cssTreeRoot = path.resolve(path.dirname(require.resolve('css-tree')), '..')
mkdirSync(cssTreeDataDir, { recursive: true })
copyFileSync(path.join(cssTreeRoot, 'data', 'patch.json'), cssTreePatchFile)
copyFileSync(path.join(cssTreeRoot, 'package.json'), cssTreePackageFile)

writeFileSync(markerFile, jsdomVersion)
console.log(`[bundle-test-dom] wrote ${outFile}`)
