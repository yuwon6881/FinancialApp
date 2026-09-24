import { readFileSync } from 'node:fs'

const configPath = new URL('../android/app/google-services.json', import.meta.url)
const androidGradlePath = new URL('../android/app/build.gradle', import.meta.url)

let config
try {
  config = JSON.parse(readFileSync(configPath, 'utf8'))
} catch (error) {
  throw new Error('Android push builds require a valid android/app/google-services.json.', { cause: error })
}

const projectId = process.env.FIREBASE_PROJECT_ID?.trim()
if (!projectId) throw new Error('FIREBASE_PROJECT_ID must name the Firebase project used by the API sender.')

const androidGradle = readFileSync(androidGradlePath, 'utf8')
const appId = androidGradle.match(/applicationId\s+["']([^"']+)["']/)?.[1]
if (!appId) throw new Error('Could not read applicationId from android/app/build.gradle.')

if (config.project_info?.project_id !== projectId) {
  throw new Error(`Firebase config project does not match FIREBASE_PROJECT_ID (${projectId}).`)
}

const hasMatchingAndroidClient = config.client?.some(
  client => client.client_info?.android_client_info?.package_name === appId,
)
if (!hasMatchingAndroidClient) {
  throw new Error(`Firebase config has no Android client for ${appId}.`)
}

console.log(`Firebase Android config matches ${appId} and ${projectId}.`)
