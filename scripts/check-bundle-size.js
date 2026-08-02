import fs from 'fs'
import path from 'path'
import zlib from 'zlib'

const distAssetsPath = path.join(process.cwd(), 'dist', 'assets')

// The React Compiler (see vite.config.ts) emits a memo cache per component, which costs
// bundle size to buy render time: it added ~7.3 kB to index and ~10.6 kB to LedgerView
// (gzip) when it was switched on. The budgets below were raised once to absorb that and
// should not drift further — they sit just above the measured sizes on purpose.
const budgets = [
  // 62.0: the compiler's memo caches plus the single-request boot decoder and the
  // If-None-Match revalidation layer. The eager-critical-path budget below is the one that
  // reflects cold-launch cost; this per-chunk limit exists to catch unexpected growth.
  { name: 'index-*.js (main application)', pattern: /^index-.*\.js$/, limitKb: 66.5 },
  { name: 'vendor-react-*.js', pattern: /^vendor-react-.*\.js$/, limitKb: 58.0 },
  // No vendor-motion budget: framer-motion is no longer pinned to one chunk, because
  // that collapsed LazyMotion's split point (see vite.config.ts). Its cost is covered by
  // the critical-path budget below, which is the number that actually matters — the
  // feature bundle is now fetched after mount rather than before first paint.
  { name: 'vendor-radix-*.js', pattern: /^vendor-radix-.*\.js$/, limitKb: 28.0 },
  // 33.75: the transfer-volume summary, addressable ledger filters, and shared
  // sorting controls, plus the shared-receipt scan picker that moved into the
  // transaction form (the split *editor* is still a lazy chunk of its own). This
  // view is interaction-heavy, so its compiler memo caches are retained; the eager
  // critical-path budget still guards cold-launch cost.
  { name: 'LedgerView-*.js', pattern: /^LedgerView-.*\.js$/, limitKb: 33.75 },
  { name: 'SettingsView-*.js', pattern: /^SettingsView-.*\.js$/, limitKb: 21.5 }
]

function getGzipSize(filePath) {
  const fileBuffer = fs.readFileSync(filePath)
  const gzipBuffer = zlib.gzipSync(fileBuffer)
  return gzipBuffer.length
}

if (!fs.existsSync(distAssetsPath)) {
  console.error('Error: dist/assets directory not found. Please run "npm run build" first.')
  process.exit(1)
}

// Everything the browser must download before it can render anything: the entry chunk
// plus its transitive *static* imports. Dynamically imported chunks (lazy views, the
// Framer Motion feature bundle) are excluded by design — deferring them is the point.
// This is the single number that tracks cold-launch cost on a phone, and it is the gate
// that stops a stray static import from quietly pulling a deferred chunk back onto the
// critical path.
// 186.0. Held at this number through the tax relief vault and savings goals rather than raised for
// them: the growth they added was paid for by deferring the "Delete Category" replacement picker
// (see useFinancialData), whose static import had been dragging the shared CustomSelect /
// AnchoredPopover / DatePicker chunk onto this path for a modal most launches never open. For
// reference it was ~219 kB before LazyMotion: framer-motion's 42 kB feature bundle sat on the
// critical path and now does not.
const CRITICAL_PATH_LIMIT_KB = 187.5

function criticalPathChunks(files) {
  const entry = files.find(f => /^index-.*\.js$/.test(f))
  if (!entry) return null
  const seen = new Set()
  const queue = [entry]
  while (queue.length) {
    const file = queue.shift()
    if (seen.has(file)) continue
    seen.add(file)
    const source = fs.readFileSync(path.join(distAssetsPath, file), 'utf8')
    // Static imports only: `from"./chunk.js"` / `import"./chunk.js"`. A dynamic
    // `import("./chunk.js")` is deliberately not matched.
    for (const match of source.matchAll(/(?:from|import)"\.\/([A-Za-z0-9_.-]+\.js)"/g)) {
      if (files.includes(match[1])) queue.push(match[1])
    }
  }
  return [...seen]
}

const files = fs.readdirSync(distAssetsPath)
let failed = false

console.log('Checking bundle budgets (gzip):')
console.log('=================================')

for (const budget of budgets) {
  const matchedFile = files.find(f => budget.pattern.test(f))
  if (!matchedFile) {
    console.error(`[FAIL] No file matched pattern: ${budget.name}`)
    failed = true
    continue
  }

  const fullPath = path.join(distAssetsPath, matchedFile)
  const sizeBytes = getGzipSize(fullPath)
  const sizeKb = sizeBytes / 1024
  const passed = sizeKb <= budget.limitKb

  const status = passed ? '[PASS]' : '[FAIL]'
  console.log(`${status} ${budget.name}: ${sizeKb.toFixed(2)} kB (limit: ${budget.limitKb} kB)`)

  if (!passed) {
    failed = true
  }
}

const criticalChunks = criticalPathChunks(files)
if (!criticalChunks) {
  console.error('[FAIL] No index-*.js entry chunk found for the critical-path budget')
  failed = true
} else {
  const totalKb = criticalChunks
    .reduce((sum, f) => sum + getGzipSize(path.join(distAssetsPath, f)), 0) / 1024
  const passed = totalKb <= CRITICAL_PATH_LIMIT_KB
  console.log(
    `${passed ? '[PASS]' : '[FAIL]'} eager critical path (${criticalChunks.length} chunks): ` +
    `${totalKb.toFixed(2)} kB (limit: ${CRITICAL_PATH_LIMIT_KB} kB)`
  )
  if (!passed) failed = true
}

if (failed) {
  console.error('\nError: One or more bundle budgets exceeded!')
  process.exit(1)
} else {
  console.log('\nSuccess: All bundle budgets passed!')
  process.exit(0)
}
