import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAssetLinks, parseCertificateFingerprints } from './assetlinks.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const output = resolve(scriptDir, '../public/.well-known/assetlinks.json')
const playFingerprints = parseCertificateFingerprints(
  process.env.ANDROID_APP_SIGNING_CERT_SHA256,
  'ANDROID_APP_SIGNING_CERT_SHA256',
)
const debugFingerprints = parseCertificateFingerprints(
  process.env.ANDROID_DEBUG_SIGNING_CERT_SHA256,
  'ANDROID_DEBUG_SIGNING_CERT_SHA256',
)
const fingerprints = [...playFingerprints, ...debugFingerprints]
const isVercelProductionBuild = process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'production'

if (isVercelProductionBuild && fingerprints.length === 0) {
  throw new Error('Production Vercel builds require at least one Android signing certificate fingerprint for Digital Asset Links.')
}

if (fingerprints.length === 0) {
  await rm(output, { force: true })
  console.warn('Digital Asset Links omitted: configure an Android signing certificate fingerprint to enable Android passkeys.')
} else {
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(createAssetLinks(fingerprints), null, 2)}\n`)
}
