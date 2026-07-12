import fs from 'fs'
import path from 'path'
import zlib from 'zlib'

const distAssetsPath = path.join(process.cwd(), 'dist', 'assets')

const budgets = [
  { name: 'index-*.js (main application)', pattern: /^index-.*\.js$/, limitKb: 60.0 },
  { name: 'vendor-react-*.js', pattern: /^vendor-react-.*\.js$/, limitKb: 58.0 },
  { name: 'vendor-motion-*.js', pattern: /^vendor-motion-.*\.js$/, limitKb: 46.0 },
  { name: 'vendor-radix-*.js', pattern: /^vendor-radix-.*\.js$/, limitKb: 28.0 },
  { name: 'LedgerView-*.js', pattern: /^LedgerView-.*\.js$/, limitKb: 21.0 },
  { name: 'SettingsView-*.js', pattern: /^SettingsView-.*\.js$/, limitKb: 21.0 }
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

if (failed) {
  console.error('\nError: One or more bundle budgets exceeded!')
  process.exit(1)
} else {
  console.log('\nSuccess: All bundle budgets passed!')
  process.exit(0)
}
