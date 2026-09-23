import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '..')
const background = { r: 11, g: 14, b: 20, alpha: 1 }
const sourcePath = resolve(root, 'public/icon-512.png')
const iconBytes = await readFile(sourcePath)
const rawIcon = await sharp(iconBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true })

// Make the white brand mark transparent for Android adaptive icons and clean iOS splash screens.
for (let offset = 0; offset < rawIcon.data.length; offset += 4) {
  if (rawIcon.data[offset] === background.r
    && rawIcon.data[offset + 1] === background.g
    && rawIcon.data[offset + 2] === background.b) rawIcon.data[offset + 3] = 0
}
const foreground = await sharp(rawIcon.data, {
  raw: { width: rawIcon.info.width, height: rawIcon.info.height, channels: 4 },
}).png().toBuffer()

async function writePng(path, image) {
  await mkdir(dirname(path), { recursive: true })
  await image.png().toFile(path)
}

const androidRes = resolve(root, 'android/app/src/main/res')
for (const [density, size] of Object.entries({ mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 })) {
  const directory = resolve(androidRes, `mipmap-${density}`)
  await writePng(resolve(directory, 'ic_launcher.png'), sharp(iconBytes).resize(size, size))
  await writePng(resolve(directory, 'ic_launcher_round.png'), sharp(iconBytes).resize(size, size))
  const foregroundSize = Math.round(size * 2.25)
  await writePng(resolve(directory, 'ic_launcher_foreground.png'), sharp(foreground).resize(foregroundSize, foregroundSize))
}

const splashPaths = []
async function collectSplashFiles(directory) {
  for (const entry of await (await import('node:fs/promises')).readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) await collectSplashFiles(path)
    else if (entry.name === 'splash.png') splashPaths.push(path)
  }
}
await collectSplashFiles(androidRes)
for (const path of splashPaths) {
  const metadata = await sharp(path).metadata()
  const width = metadata.width ?? 512
  const height = metadata.height ?? 512
  const logoSize = Math.round(Math.min(width, height) * 0.3)
  const logo = await sharp(foreground).resize(logoSize, logoSize).png().toBuffer()
  await writePng(path, sharp({ create: { width, height, channels: 4, background } })
    .composite([{ input: logo, gravity: 'centre' }]))
}

const iosAssets = resolve(root, 'ios/App/App/Assets.xcassets')
await writePng(resolve(iosAssets, 'AppIcon.appiconset/AppIcon-512@2x.png'),
  sharp(iconBytes).resize(1024, 1024).flatten({ background }))
for (const suffix of ['', '-1', '-2']) {
  const path = resolve(iosAssets, `Splash.imageset/splash-2732x2732${suffix}.png`)
  const logo = await sharp(foreground).resize(560, 560).png().toBuffer()
  await writePng(path, sharp({ create: { width: 2732, height: 2732, channels: 4, background } })
    .composite([{ input: logo, gravity: 'centre' }]))
}

console.log(`Generated native launcher and splash assets from ${sourcePath}.`)
