import { parseCertificateFingerprints, validatePublishedAssetLinks } from './assetlinks.mjs'

const url = 'https://financialapp-ecru.vercel.app/.well-known/assetlinks.json'
const playFingerprints = parseCertificateFingerprints(
  process.env.ANDROID_APP_SIGNING_CERT_SHA256,
  'ANDROID_APP_SIGNING_CERT_SHA256',
)
const debugFingerprints = parseCertificateFingerprints(
  process.env.ANDROID_DEBUG_SIGNING_CERT_SHA256,
  'ANDROID_DEBUG_SIGNING_CERT_SHA256',
)
const expectedFingerprints = [...playFingerprints, ...debugFingerprints]

if (debugFingerprints.length === 0) {
  throw new Error('Set ANDROID_DEBUG_SIGNING_CERT_SHA256 before checking the production device-test association.')
}

const deadline = Date.now() + 5 * 60_000
let lastError
while (Date.now() < deadline) {
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    })
    const body = await response.text()
    validatePublishedAssetLinks({
      status: response.status,
      redirectLocation: response.headers.get('location'),
      contentType: response.headers.get('content-type') ?? '',
      body,
    }, expectedFingerprints)
    console.log(`Production Digital Asset Links verified: HTTP 200, no redirect, valid JSON, and ${expectedFingerprints.length} configured certificate(s) published.`)
    process.exit(0)
  } catch (error) {
    lastError = error
    console.log(`Production association is not ready: ${error.message}. Retrying in 10 seconds.`)
    await new Promise(resolve => setTimeout(resolve, 10_000))
  }
}

throw new Error(`Production Digital Asset Links verification failed after waiting for deployment: ${lastError?.message ?? 'unknown error'}`)
