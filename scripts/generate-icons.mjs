// Renders the Lumen brand tile (scripts/brand-mark.mjs) into every icon the PWA manifest, the
// browser tab and iOS need. Run after changing the mark: `node scripts/generate-icons.mjs`.
import { writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import { tileSvg } from './brand-mark.mjs'

// The mark spans 54% of the tile, the same optical size as the sibling apps' icons (Workout,
// Nutrition, Calendar), so the four sit evenly side by side on a home screen. Launchers mask the
// square themselves, so the maskable and iOS icons are full-bleed; the "any" icons carry the same
// 22.5% corners as the sibling apps, because a desktop or browser shows them as drawn. The mark
// already sits inside the maskable safe zone (a centred circle of 80%), so one drawing serves both.
const square = tileSvg({ size: 1024 })
const rounded = tileSvg({ size: 1024, radius: 22.5 })

const jobs = [
  [rounded, 192, 'public/icon-192.png'],
  [rounded, 512, 'public/icon-512.png'],
  [square, 192, 'public/icon-192-maskable.png'],
  [square, 512, 'public/icon-512-maskable.png'],
  [square, 180, 'public/apple-touch-icon.png'],
]

for (const [svg, size, out] of jobs) {
  await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(out)
  console.log(`wrote ${out} (${size}x${size})`)
}

// The tab icon keeps its own rounding: a browser draws it as-is.
await writeFile('public/favicon.svg', `${tileSvg({ size: 100, radius: 22.5 }).replace(' width="100" height="100"', ' width="100%" height="100%"')}\n`)
console.log('wrote public/favicon.svg')
