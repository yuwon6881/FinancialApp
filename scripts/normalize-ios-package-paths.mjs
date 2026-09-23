import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const packagePath = fileURLToPath(new URL('../ios/App/CapApp-SPM/Package.swift', import.meta.url))
const packageText = readFileSync(packagePath, 'utf8')
const normalizedText = packageText.replace(/(\bpath:\s*")([^"]*)(")/g, (_match, prefix, path, suffix) => {
  return `${prefix}${path.replaceAll('\\', '/')}${suffix}`
})

if (normalizedText !== packageText) {
  writeFileSync(packagePath, normalizedText)
  console.log('Normalized local Swift package paths for macOS.')
} else {
  console.log('Swift package paths are already portable.')
}
