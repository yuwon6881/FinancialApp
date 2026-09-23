const APP_PACKAGE_NAME = 'com.financialapp.app'

export function normalizeCertificateFingerprint(value, variableName = 'Android certificate fingerprint') {
  const normalized = value.replaceAll(':', '').trim().toUpperCase()
  if (!/^[0-9A-F]{64}$/.test(normalized)) {
    throw new Error(`${variableName} must be a 32-byte SHA-256 certificate fingerprint.`)
  }
  return normalized.match(/.{2}/g).join(':')
}

export function parseCertificateFingerprints(value, variableName) {
  if (!value?.trim()) return []
  const fingerprints = value.split(',').map(part => normalizeCertificateFingerprint(part, variableName))
  return [...new Set(fingerprints)]
}

export function createAssetLinks(fingerprints) {
  if (fingerprints.length === 0) throw new Error('At least one Android signing certificate fingerprint is required.')
  return [{
    relation: ['delegate_permission/common.get_login_creds', 'delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: APP_PACKAGE_NAME,
      sha256_cert_fingerprints: [...new Set(fingerprints)],
    },
  }]
}

export function validatePublishedAssetLinks({ status, redirectLocation, contentType, body }, expectedFingerprints) {
  if (status !== 200) throw new Error(`Expected HTTP 200 from the production Digital Asset Links URL, received ${status}.`)
  if (redirectLocation) throw new Error('The production Digital Asset Links URL must not redirect.')
  if (!contentType?.toLowerCase().includes('application/json')) {
    throw new Error('The production Digital Asset Links response must use application/json.')
  }

  let statements
  try {
    statements = JSON.parse(body)
  } catch {
    throw new Error('The production Digital Asset Links response is not valid JSON.')
  }

  const statement = Array.isArray(statements)
    ? statements.find(entry => entry?.target?.namespace === 'android_app' && entry.target.package_name === APP_PACKAGE_NAME)
    : undefined
  if (!statement) throw new Error(`The production Digital Asset Links response has no association for ${APP_PACKAGE_NAME}.`)

  const requiredRelations = [
    'delegate_permission/common.get_login_creds',
    'delegate_permission/common.handle_all_urls',
  ]
  if (!requiredRelations.every(relation => statement.relation?.includes(relation))) {
    throw new Error('The production Digital Asset Links association is missing a required relation.')
  }

  const configured = expectedFingerprints.map(fingerprint => normalizeCertificateFingerprint(fingerprint))
  const published = (statement.target.sha256_cert_fingerprints ?? []).map(fingerprint => normalizeCertificateFingerprint(fingerprint))
  if (configured.some(fingerprint => !published.includes(fingerprint))) {
    throw new Error('The production Digital Asset Links association is missing a configured signing certificate.')
  }
  return statement
}
