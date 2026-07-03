// One-off generator: renders the "F" brand mark (same design as the inline
// splash in index.html and public/favicon.svg) into every PNG icon the PWA
// manifest and iOS need. Run with: node scripts/generate-icons.mjs
import sharp from 'sharp'

const F_PATH = 'M30 32h40v8H38v12h28v8H38v16h-8V32z'

// Rounded tile with transparent corners — for purpose:"any" icons.
const tile = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="1024" height="1024">
  <rect width="100" height="100" rx="22" fill="#1a1f2e" />
  <path d="${F_PATH}" fill="#60a5fa" />
</svg>`

// Maskable icon: full-bleed required so any adaptive-icon shape mask works.
// Uses a very slightly darker outer band so the rounded tile shape reads even
// on launchers that display icons without applying their own shape clip.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="1024" height="1024">
  <rect width="100" height="100" fill="#131820" />
  <rect width="100" height="100" rx="22" fill="#1a1f2e" />
  <path d="${F_PATH}" fill="#60a5fa" />
</svg>`

const jobs = [
  [tile, 192, 'public/icon-192.png'],
  [tile, 512, 'public/icon-512.png'],
  [maskable, 192, 'public/icon-192-maskable.png'],
  [maskable, 512, 'public/icon-512-maskable.png'],
  [maskable, 180, 'public/apple-touch-icon.png'],
]

for (const [svg, size, out] of jobs) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(out)
  console.log(`wrote ${out} (${size}x${size})`)
}
