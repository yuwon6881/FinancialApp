import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import {
  createAssetLinks,
  normalizeCertificateFingerprint,
  parseCertificateFingerprints,
  validatePublishedAssetLinks,
} from './assetlinks.mjs'

const PLAY_CERTIFICATE = '00'.repeat(32)
const DEBUG_CERTIFICATE = '11'.repeat(32)

test('normalizes fingerprints and generates one association containing Play and debug signing keys', () => {
  const fingerprints = [
    ...parseCertificateFingerprints(PLAY_CERTIFICATE, 'ANDROID_APP_SIGNING_CERT_SHA256'),
    ...parseCertificateFingerprints(DEBUG_CERTIFICATE, 'ANDROID_DEBUG_SIGNING_CERT_SHA256'),
  ]
  const [statement] = createAssetLinks(fingerprints)

  assert.deepEqual(statement.relation, [
    'delegate_permission/common.get_login_creds',
    'delegate_permission/common.handle_all_urls',
  ])
  assert.equal(statement.target.namespace, 'android_app')
  assert.equal(statement.target.package_name, 'com.financialapp.app')
  assert.deepEqual(statement.target.sha256_cert_fingerprints, [
    PLAY_CERTIFICATE.match(/.{2}/g).join(':'),
    DEBUG_CERTIFICATE.match(/.{2}/g).join(':'),
  ])
})

test('deduplicates repeated fingerprints and rejects malformed certificates', () => {
  assert.deepEqual(
    parseCertificateFingerprints(`${PLAY_CERTIFICATE},${PLAY_CERTIFICATE}`, 'fingerprints'),
    [normalizeCertificateFingerprint(PLAY_CERTIFICATE)],
  )
  assert.throws(() => normalizeCertificateFingerprint('00:11', 'ANDROID_DEBUG_SIGNING_CERT_SHA256'), /ANDROID_DEBUG_SIGNING_CERT_SHA256/)
})

test('fails production builds when no association fingerprint is configured', () => {
  const scriptPath = fileURLToPath(new URL('./write-assetlinks.mjs', import.meta.url))
  const result = spawnSync(process.execPath, [scriptPath], {
    env: {
      ...process.env,
      VERCEL: '1',
      VERCEL_ENV: 'production',
      ANDROID_APP_SIGNING_CERT_SHA256: '',
      ANDROID_DEBUG_SIGNING_CERT_SHA256: '',
    },
    encoding: 'utf8',
  })

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Production Vercel builds require at least one Android signing certificate fingerprint/)
})

test('validates a production response without following redirects and requires configured fingerprints', () => {
  const [statement] = createAssetLinks([PLAY_CERTIFICATE, DEBUG_CERTIFICATE])
  const response = {
    status: 200,
    redirectLocation: null,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify([statement]),
  }

  assert.doesNotThrow(() => validatePublishedAssetLinks(response, [PLAY_CERTIFICATE, DEBUG_CERTIFICATE]))
  assert.throws(() => validatePublishedAssetLinks({ ...response, status: 308, redirectLocation: '/new' }, [PLAY_CERTIFICATE]), /HTTP 200/)
  assert.throws(() => validatePublishedAssetLinks(response, ['22'.repeat(32)]), /missing a configured signing certificate/)
  assert.throws(() => validatePublishedAssetLinks({ ...response, body: 'not json' }, [PLAY_CERTIFICATE]), /not valid JSON/)
})
