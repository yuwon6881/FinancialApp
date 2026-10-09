// Native launcher and splash assets for Android and iOS, drawn from the same Lumen mark as the
// PWA icons (scripts/brand-mark.mjs). Run `node scripts/generate-icons.mjs` first.
import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'
import { BRAND, markSvg, tileSvg } from './brand-mark.mjs'

const root = resolve(import.meta.dirname, '..')
const hex = value => ({ r: parseInt(value.slice(1, 3), 16), g: parseInt(value.slice(3, 5), 16), b: parseInt(value.slice(5, 7), 16), alpha: 1 })
const canvas = hex(BRAND.canvasNight)

async function writePng(path, image) {
  await mkdir(dirname(path), { recursive: true })
  await image.png({ compressionLevel: 9 }).toFile(path)
}
const render = (svg, size) => sharp(Buffer.from(svg)).resize(size, size)

// Android adaptive icons draw the foreground on a 108dp canvas and show the middle 72dp; the mark
// is scaled into that window. The legacy and round launchers get the full tile.
const androidRes = resolve(root, 'android/app/src/main/res')
const ADAPTIVE_SCALE = 72 / 108
for (const [density, size] of Object.entries({ mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 })) {
  const directory = resolve(androidRes, `mipmap-${density}`)
  await writePng(resolve(directory, 'ic_launcher.png'), render(tileSvg({ size: 1024, radius: 22 }), size))
  await writePng(resolve(directory, 'ic_launcher_round.png'), render(tileSvg({ size: 1024, radius: 50 }), size))
  const layerSize = Math.round(size * 2.25)
  await writePng(resolve(directory, 'ic_launcher_foreground.png'), render(markSvg({ scale: ADAPTIVE_SCALE }), layerSize))
  // Android 13 themed icons tint this layer with the wallpaper colour.
  await writePng(resolve(directory, 'ic_launcher_monochrome.png'), render(markSvg({ scale: ADAPTIVE_SCALE }), layerSize))
}

// Splash: the rounded Iris tile centred on the Night canvas, the same picture the PWA launch shows.
const splashPaths = []
async function collectSplashFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
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
  const logoSize = Math.round(Math.min(width, height) * 0.22)
  const logo = await render(tileSvg({ size: 1024, radius: 22 }), logoSize).png().toBuffer()
  await writePng(path, sharp({ create: { width, height, channels: 4, background: canvas } })
    .composite([{ input: logo, gravity: 'centre' }]))
}

const iosAssets = resolve(root, 'ios/App/App/Assets.xcassets')
await writePng(resolve(iosAssets, 'AppIcon.appiconset/AppIcon-512@2x.png'), render(tileSvg({ size: 1024 }), 1024).flatten({ background: hex(BRAND.iris) }))
for (const suffix of ['', '-1', '-2']) {
  const path = resolve(iosAssets, `Splash.imageset/splash-2732x2732${suffix}.png`)
  const logo = await render(tileSvg({ size: 1024, radius: 22 }), 520).png().toBuffer()
  await writePng(path, sharp({ create: { width: 2732, height: 2732, channels: 4, background: canvas } })
    .composite([{ input: logo, gravity: 'centre' }]))
}

await writeFile(resolve(androidRes, 'values/ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${BRAND.iris}</color>
</resources>
`)

console.log('Generated native launcher, monochrome and splash assets from scripts/brand-mark.mjs.')
