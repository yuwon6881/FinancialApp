import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const output = resolve(scriptDir, '../public/.well-known/assetlinks.json')
const configured = process.env.ANDROID_APP_SIGNING_CERT_SHA256?.trim() ?? ''

if (!configured) {
  await rm(output, { force: true })
  console.warn('Digital Asset Links omitted: set ANDROID_APP_SIGNING_CERT_SHA256 to enable Android passkeys.')
} else {
  const fingerprintHex = configured.replaceAll(':', '').toUpperCase()
  if (!/^[0-9A-F]{64}$/.test(fingerprintHex)) {
    throw new Error('ANDROID_APP_SIGNING_CERT_SHA256 must be a 32-byte SHA-256 certificate fingerprint.')
  }
  const fingerprint = fingerprintHex.match(/.{2}/g).join(':')

  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify([{
    relation: ['delegate_permission/common.get_login_creds', 'delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'com.financialapp.app',
      sha256_cert_fingerprints: [fingerprint],
    },
  }], null, 2)}\n`)
}
