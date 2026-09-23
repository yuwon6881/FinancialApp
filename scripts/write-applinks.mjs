import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const output = resolve(scriptDir, '../public/.well-known/apple-app-site-association')
const teamId = process.env.IOS_APPLE_TEAM_ID?.trim() ?? ''

if (!teamId) {
  await rm(output, { force: true })
  console.warn('Apple App Site Association omitted: set IOS_APPLE_TEAM_ID to enable iOS passkeys.')
} else {
  if (!/^[A-Z0-9]{10}$/.test(teamId)) {
    throw new Error('IOS_APPLE_TEAM_ID must be the 10-character Apple Developer Team ID.')
  }

  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify({
    webcredentials: { apps: [`${teamId}.com.financialapp.app`] },
  }, null, 2)}\n`)
}
