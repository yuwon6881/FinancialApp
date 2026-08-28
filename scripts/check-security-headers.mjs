import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'))
const rules = Array.isArray(vercel.headers) ? vercel.headers : []
const shellRule = rules.find(rule => rule.source === '/(.*)')
const assetRule = rules.find(rule => rule.source === '/assets/:path*')
if (!shellRule || !assetRule) throw new Error('Vercel shell and hashed-asset header rules are required.')

const headers = new Map(shellRule.headers.map(header => [header.key.toLowerCase(), header.value]))
const required = new Map([
  ['strict-transport-security', 'max-age=31536000; includeSubDomains'],
  ['x-content-type-options', 'nosniff'],
  ['referrer-policy', 'no-referrer'],
  ['x-frame-options', 'DENY'],
])
for (const [name, expected] of required) {
  if (headers.get(name) !== expected) throw new Error(`${name} must be ${expected}.`)
}

const csp = headers.get('content-security-policy') ?? ''
for (const directive of [
  "default-src 'self'",
  "script-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "worker-src 'self' blob:",
  'https://firebaseinstallations.googleapis.com',
  'https://fcmregistrations.googleapis.com',
  'https://fcm.googleapis.com',
]) {
  if (!csp.includes(directive)) throw new Error(`HTTP CSP is missing ${directive}.`)
}

const permissions = headers.get('permissions-policy') ?? ''
for (const policy of ['camera=(self)', 'clipboard-write=(self)', 'geolocation=()', 'microphone=()', 'payment=()']) {
  if (!permissions.includes(policy)) throw new Error(`Permissions-Policy is missing ${policy}.`)
}

const assetCache = new Map(assetRule.headers.map(header => [header.key.toLowerCase(), header.value]))
if (assetCache.get('cache-control') !== 'public, max-age=31536000, immutable') {
  throw new Error('Hashed assets must retain their immutable cache policy.')
}

const indexHtml = readFileSync(join('dist', 'index.html'), 'utf8')
const metaTag = indexHtml.match(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/i)?.[0] ?? ''
const metaContent = metaTag.match(/\bcontent="([^"]*)"/i)?.[1]
  ?? metaTag.match(/\bcontent='([^']*)'/i)?.[1]
  ?? ''
if (!metaContent.includes("frame-ancestors 'none'")) {
  throw new Error('The built Capacitor/web shell must retain its generated meta CSP.')
}
const assetNames = readdirSync(join('dist', 'assets'))
if (!assetNames.some(name => /^index-[A-Za-z0-9_-]+\.js$/.test(name))) {
  throw new Error('The production build did not produce a hashed application script.')
}

console.log('Web security-header and built-shell contract passed.')
